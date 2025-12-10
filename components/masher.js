// =================================================================
// CHUNK: Chunk-based Heuristic Unification for Natural Kartography
// =================================================================
// 1) Split into chunks
// 2) Choose chunks (based on heuristics)
// 3) Reassemble/unify chunks

const TPAnalysis = require('./tp_analysis').default;
const PreviewGenerator = require('./preview_generator');
const createHull = require('hull');
const { buffer } = require('node:stream/consumers');
const savePixels = require("save-pixels");
const SAT = require('sat');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { unpack } = require('msgpackr');
const { createWriteStream, writeFileSync } = fs;
const { mapIDToTileMap, colorize, ndarray, matrixToHTML, spliceMatrix, TILE_IDS, TILE_COLORS, SYMMETRY } = TPAnalysis;

const Masher = {};

const OPTIMIZER_SETTINGS = {
	CHUNK_HULL_CONCAVITY: 3.5,
	DEFAULT_NUMBER_OF_MECHANICS: 4,
	FINAL_SHAPE_SCALAR: 1.5,
	DEBUG_MODE: false
};

const normalizeMapID = (mapID) => {
	const numeric = Number(mapID);
	return Number.isFinite(numeric) ? numeric : String(mapID);
};

const serializeVector = (vec) => vec ? { x: vec.x, y: vec.y } : null;
const deserializeVector = (obj) => obj ? new SAT.Vector(obj.x, obj.y) : null;

const serializeMatrix = (matrix) => ({
	shape: matrix.shape,
	data: Array.from(matrix.data)
});

const deserializeMatrix = (serialized) => ndarray(new Float32Array(serialized.data), serialized.shape);

const serializePolygon = (polygon) => ({
	pos: serializeVector(polygon.pos),
	points: polygon.points.map(serializeVector)
});

const deserializePolygon = (serialized) => new SAT.Polygon(
	deserializeVector(serialized.pos),
	serialized.points.map(deserializeVector)
);

const serializeMapChunk = (chunk) => ({
	id: chunk.id,
	type: chunk.type,
	features: {
		...chunk.features,
		flagPosition: serializeVector(chunk.features.flagPosition)
	},
	positions: {
		centerOfMass: serializeVector(chunk.positions.centerOfMass),
		relCoM: serializeVector(chunk.positions.relCoM),
		flag: serializeVector(chunk.positions.flag)
	},
	tiles: serializeMatrix(chunk.tiles),
	hull: serializePolygon(chunk.hull)
});

const deserializeMapChunk = (serialized) => ({
	...serialized,
	features: {
		...serialized.features,
		flagPosition: deserializeVector(serialized.features.flagPosition)
	},
	positions: {
		centerOfMass: deserializeVector(serialized.positions.centerOfMass),
		relCoM: deserializeVector(serialized.positions.relCoM),
		flag: deserializeVector(serialized.positions.flag)
	},
	tiles: deserializeMatrix(serialized.tiles),
	hull: deserializePolygon(serialized.hull)
});

const serializeChunkModel = (entries=[]) => entries.map(entry => ({
	mapID: entry.mapID,
	shape: entry.shape,
	chunkMask: serializeMatrix(entry.chunkMask),
	mapChunks: entry.mapChunks.map(serializeMapChunk)
}));

const deserializeChunkModel = (serialized=[]) => serialized.map(entry => ({
	mapID: entry.mapID,
	shape: entry.shape,
	chunkMask: deserializeMatrix(entry.chunkMask),
	mapChunks: entry.mapChunks.map(deserializeMapChunk)
}));

const cloneChunkModel = (entries=[]) => deserializeChunkModel(serializeChunkModel(entries));

const createMapInfo = (mapID, tileMap, chunkData) => ({
	mapID: normalizeMapID(mapID),
	shape: tileMap.shape,
	chunkMask: chunkData.chunkMask,
	mapChunks: chunkData.mapChunks
});

async function buildMapInfoFromMapID(mapID) {
	const tileMap = await mapIDToTileMap(mapID);
	const chunkData = await extractMapChunks(tileMap);
	return createMapInfo(mapID, tileMap, chunkData);
}

async function loadChunkModel(modelPath) {
	const resolvedPath = path.isAbsolute(modelPath) ? modelPath : path.join(process.cwd(), modelPath);
	const buffer = await fsPromises.readFile(resolvedPath);
	const serialized = unpack(buffer);
	return deserializeChunkModel(serialized);
}

Masher.mashMaps = async (chunkModelInput, options={}) => {
	const mashOptions = {
		preview: true,
		returnAssets: false,
		mapName: options.mapName || 'CHUNK v1 Map',
		author: options.author || 'CHUNK',
		...options
	};

	const mapInfos = Array.isArray(chunkModelInput) ? cloneChunkModel(chunkModelInput) : [];
	if(!mapInfos.length) throw new Error("No chunk model data available for mashMaps.");

	const allChunks = mapInfos.map(mI => mI.mapChunks).flat();
	const numberOfMechs = OPTIMIZER_SETTINGS.DEFAULT_NUMBER_OF_MECHANICS;
	shuffleArray(allChunks);

	const mapSize = new SAT.Vector(...[
		mapInfos.reduce((a, m) => a + m.shape[0], 0),
		mapInfos.reduce((a, m) => a + m.shape[1], 0)
	].map(a => a / mapInfos.length));
	const chosenBase = allChunks.find(c => c.type === 'base');
	const chosenMechs = allChunks.filter(c => c.type === 'mech').slice(0, numberOfMechs);

	const optimizer = new MapOptimizer(mapSize, SYMMETRY.ROTATIONAL, chosenBase, chosenMechs);
	console.log(await optimizer.optimize());

	const optimizedMap = optimizer.rasterize();

	if(OPTIMIZER_SETTINGS.DEBUG_MODE || options.debug) {
		savePixels(colorize(chosenBase.tiles, TILE_COLORS), "png").pipe(createWriteStream(`${__dirname}/../admin_tools/mechs/base.png`, {
			autoClose: true,
			flags: 'w'
		}));

		const hullPolygons = optimizer.shapes.map(s => s.hull.calcPoints.map(p => [p.x, p.y]));
		const minHullPoint = hullPolygons.reduce((a, v) => a.concat(v), []).reduce((a, v) => [Math.min(a[0], v[0]), Math.min(a[1], v[1])]);
		const maxHullPoint = hullPolygons.reduce((a, v) => a.concat(v), []).reduce((a, v) => [Math.max(a[0], v[0]), Math.max(a[1], v[1])]);

		const hullSVG = TPAnalysis.createBaseDocument(maxHullPoint[0] - minHullPoint[0], maxHullPoint[1] - minHullPoint[1]);
		const hullPolygonsNormalized = hullPolygons.map(p => p.map(v => [v[0] - minHullPoint[0], v[1] - minHullPoint[1]]));
		TPAnalysis.addPolygonLayer(hullSVG, hullPolygonsNormalized);
		hullSVG.css({
			width: '75vh',
			height: 'auto',
		});

		const baseSVG = TPAnalysis.createBaseDocument(optimizedMap.shape[0], optimizedMap.shape[1]);
		TPAnalysis.addMatrixLayer(baseSVG, optimizedMap);
		baseSVG.css({
			width: '75vw',
			height: 'auto',
		});

		const previewSVGs = [];
		for (let i = 0; i < mapInfos.length; i++) {
			const previewSVG = TPAnalysis.createBaseDocument(mapInfos[i].shape[0], mapInfos[i].shape[1]);
			TPAnalysis.addMapPreviewLayer(previewSVG, mapInfos[i].mapID || mapIDs[i]);
			TPAnalysis.addMatrixLayer(previewSVG, mapInfos[i].chunkMask);
			TPAnalysis.addPolygonLayer(previewSVG, mapInfos[i].mapChunks.map(c => c.hull.translate(c.positions.centerOfMass.x, c.positions.centerOfMass.y).calcPoints.map(p => [p.x, p.y])));
			previewSVG.css({
				width: '75vw',
				height: 'auto',
			});
			previewSVGs.push(previewSVG);
		}

		writeFileSync(__dirname + '/../admin_tools/view.html', `
			${baseSVG.svg()}
			${hullSVG.svg()}
			${previewSVGs.map(p => p.svg()).join('')}
		`);
	}

	const mapJSON = {
		"info":{"name": mashOptions.mapName,"author": mashOptions.author,"gameMode":"normal"},
		"switches":{},"fields":{},"portals":{},"marsballs":[],"spawnPoints":{"red":[],"blue":[]}
	};
	const sourcePNG = (await bufferStream(savePixels(colorize(optimizedMap, TILE_COLORS), "png"))).toString('base64');

	let previewCanvas = mashOptions.preview ? await PreviewGenerator.generate(
		sourcePNG,
		JSON.stringify(mapJSON)
	).catch(err => {
		console.error("PREVIEW GENERATION ERROR:", err);
		return null;
	}) : null;

	const mashResult = {
		previewCanvas,
		pngBase64: sourcePNG,
		mapJSON
	};

	return mashOptions.returnAssets ? mashResult : previewCanvas;
};

class MapOptimizer {
	constructor(targetShape, symmetry, base, mechs) {
		this.targetShape = targetShape;
		this.symmetry = symmetry;
		this.base = base;
		this.shapes = [base, ...mechs].map(c => this.createShape(c));
		this.boundingPolygon = new SAT.Polygon(new SAT.Vector(0, 0), [
			new SAT.Vector(0, 0),
			new SAT.Vector(targetShape.x, 0),
			new SAT.Vector(targetShape.x, targetShape.y),
			new SAT.Vector(0, targetShape.y)
		]);
		this.generateAffinities();

		for(let i = 0; i < this.shapes.length; i++) {
			this.shapes[i].hull.setOffset(this.shapes[i].affinity);
		}
	}

	generateAffinities() {
		for(const shape of this.shapes) {
			if(shape.chunk.type === 'base') {
				shape.affinity = shape.chunk.positions.centerOfMass;
			} else {
				const flagAffinity = this.base.features.flagPosition.clone().add(shape.chunk.positions.flag);
				const centerAffinity = shape.chunk.positions.centerOfMass;
				shape.affinity = pointAverage([flagAffinity]);
			}
		}
	}

	cost() {
		let cost = 0;

		const response = new SAT.Response();

		for(const shape of this.shapes) {
			const distFromAffinity = shape.hull.offset.clone().sub(shape.affinity).len();
			cost += distFromAffinity;

			// for(const point of shape.hull.calcPoints) {
			// 	if(!SAT.pointInPolygon(point, this.boundingPolygon)) {
			// 		cost += 1000;
			// 	}
			// }

			for(const shape2 of this.shapes) {
				if(shape.id === shape2.id) continue;
				const collided = SAT.testPolygonPolygon(shape.hull, shape2.hull, response);
				if(!collided) continue;

				cost += response.overlap ** 4;
				response.clear();
			}
		}

		return cost;
	}

	async optimize() {
		const iterations = 100;
		const flagAffinityScale = 0.01;
		const collisionAffinityScale = 0.005;

		const shapePositions = this.shapes.map(s => new SAT.Vector(s.hull.offset.x, s.hull.offset.y));

		for(let i = 0; i < iterations; i++) {
			for(let j = 0; j < this.shapes.length; j++) {
				if(this.shapes[j].chunk.type === 'base') continue;
				const shape = this.shapes[j];
				const currentVector = shapePositions[j].clone();
				const affinityVector = shape.affinity.clone().sub(currentVector).normalize().scale(flagAffinityScale);

				const collisionAffinity = new SAT.Vector(0, 0);

				for(let k = 0; k < this.shapes.length; k++) {
					if(j === k) continue;
					const otherShape = this.shapes[k];

					const response = new SAT.Response();
					const collided = SAT.testPolygonPolygon(shape.hull, otherShape.hull, response);
					if(collided) {
						collisionAffinity.add(response.overlapV.scale(-collisionAffinityScale, -collisionAffinityScale));
						// console.log(shape.chunk.id, otherShape.chunk.id, response.overlapV.len());
					}
				}
				shapePositions[j].add(collisionAffinity).add(affinityVector);// .add(centerAffinity)
			}
		}

		for(let i = 0; i < this.shapes.length; i++) {
			this.shapes[i].hull.setOffset(shapePositions[i]);
		}

		return this.cost();
	}

	rasterize() {
		const hullPolygons = this.shapes.map(s => s.hull.calcPoints.map(p => [p.x, p.y]));
		const minHullPoint = hullPolygons.reduce((a, v) => a.concat(v), []).reduce((a, v) => [Math.min(a[0], v[0]), Math.min(a[1], v[1])]);
		const maxHullPoint = hullPolygons.reduce((a, v) => a.concat(v), []).reduce((a, v) => [Math.max(a[0], v[0]), Math.max(a[1], v[1])]);

		let bigShape = new SAT.Vector(
			Math.round((maxHullPoint[0] - minHullPoint[0]) * OPTIMIZER_SETTINGS.FINAL_SHAPE_SCALAR),
			Math.round((maxHullPoint[1] - minHullPoint[1]) * OPTIMIZER_SETTINGS.FINAL_SHAPE_SCALAR)
		);

		let tileMap = ndarray(new Float32Array(bigShape.x * bigShape.y), [bigShape.x, bigShape.y]);

		let baseShape = this.shapes.find(s => s.chunk.type === 'base');
		let mechShapes = this.shapes.filter(s => s.chunk.type === 'mech');

		for(const shape of mechShapes) {
			const shapeBounds = shape.hull.getAABB();
			const shapeBoundsTopLeft = shapeBounds.calcPoints.reduce((a, v) => new SAT.Vector(Math.min(a.x, v.x), Math.min(a.y, v.y)))
				.add(shape.hull.offset).sub(new SAT.Vector(0.5, 0.5));
			const placePoint = new SAT.Vector(
				Math.round(shapeBoundsTopLeft.x - minHullPoint[0]),
				Math.round(shapeBoundsTopLeft.y - minHullPoint[1])
			);
			spliceMatrix(
				tileMap,
				placePoint.x, placePoint.y,
				shape.chunk.tiles, TILE_IDS.BACKGROUND,
				({x, y}, oldTile, newTile) => {
					if(newTile === TILE_IDS.FLOOR && ![TILE_IDS.BACKGROUND, TILE_IDS.FLOOR].includes(oldTile)) return oldTile;
					return newTile;
				}
			);
		}

		const baseBounds = baseShape.hull.getAABB();
		const baseBoundsTopLeft = baseBounds.calcPoints.reduce((a, v) => new SAT.Vector(Math.min(a.x, v.x), Math.min(a.y, v.y)))
			.add(baseShape.hull.offset).sub(new SAT.Vector(0.5, 0.5));
		spliceMatrix(
			tileMap,
			Math.round(baseBoundsTopLeft.x - minHullPoint[0]),
			Math.round(baseBoundsTopLeft.y - minHullPoint[1]),
			baseShape.chunk.tiles, TILE_IDS.BACKGROUND
		);

		tileMap = TPAnalysis.symmetrify(tileMap, this.symmetry, TILE_IDS.BACKGROUND);

		return tileMap;
	}

	createShape(chunk) {
		return {
			id: Math.random().toString(36).slice(2),
			chunk,
			hull: new SAT.Polygon(chunk.hull.pos, chunk.hull.points),
			affinity: null
		};
	}
}

function pointAverage(points) {
	return points.reduce((a, v) => a.add(v)).scale(1 / points.length);
}

function makeMapChunk(tileMap, points) {
	const dimPoints = points.reduce((a, v) => ({
		min: [Math.min(a.min[0], v[0]), Math.min(a.min[1], v[1])],
		max: [Math.max(a.max[0], v[0]), Math.max(a.max[1], v[1])],
		avg: [a.avg[0] + (v[0] / points.length), a.avg[1] + (v[1] / points.length)]
	}), {min: points[0], max: points[0], avg: [0, 0]});
	const chunkShape = [dimPoints.max[0] - dimPoints.min[0] + 1, dimPoints.max[1] - dimPoints.min[1] + 1];
	const pointHashMap = points.reduce((a, v) => ({...a, [`${v[0]},${v[1]}`]: true}), {});

	const tileCenterPoints = points.map(p => [p[0] + 0.5, p[1] + 0.5]);

	const xAllSame = tileCenterPoints.every(p => p[0] === tileCenterPoints[0][0]);
	const yAllSame = tileCenterPoints.every(p => p[1] === tileCenterPoints[0][1]);
	const chunkHullPointsRaw = (xAllSame || yAllSame)
		? tileCenterPoints
		: createHull(tileCenterPoints, OPTIMIZER_SETTINGS.CHUNK_HULL_CONCAVITY);
	const chunkHullPoints = chunkHullPointsRaw.map(p => new SAT.Vector(...p));
	const chunkHullCentroid = new SAT.Polygon(new SAT.Vector(0, 0), chunkHullPoints).getCentroid();

	const mapChunk = {
		id: Math.random().toString(36).slice(2),
		type: 'mech',
		features: {
			hasPowerup: false,
			flagPosition: null
		},
		positions: {
			centerOfMass: new SAT.Vector(...dimPoints.avg),
			relCoM: new SAT.Vector(...dimPoints.avg).scale(
				1 / tileMap.shape[0], 1 / tileMap.shape[1]
			),
			flag: null
		},
		tiles: ndarray(new Float32Array(chunkShape[0] * chunkShape[1]), chunkShape),
		hull: new SAT.Polygon(new SAT.Vector(0, 0), chunkHullPoints.map(v => v.sub(chunkHullCentroid).add(new SAT.Vector(0.5, 0.5))))
	};

	for(const point of points) {
		const tileType = tileMap.get(...point);

		if(tileType === TILE_IDS.POWERUP) mapChunk.features.hasPowerup = true;
		if([TILE_IDS.REDFLAG, TILE_IDS.BLUEFLAG].includes(tileType)) {
			mapChunk.type = 'base';
			mapChunk.features.flagPosition = new SAT.Vector(...point);
		}

		mapChunk.tiles.set(point[0] - dimPoints.min[0], point[1] - dimPoints.min[1], tileType);
	}

	return mapChunk;
}

function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}

function determinant3x3(matrix) {
	if (matrix.length !== 3 || matrix.some(row => row.length !== 3)) {
		throw new Error("Input must be a 3x3 matrix.");
	}
	
	const [a, b, c] = matrix[0];
	const [d, e, f] = matrix[1];
	const [g, h, i] = matrix[2];
	
	return (
		a * (e * i - f * h) -
		b * (d * i - f * g) +
		c * (d * h - e * g)
	);
}

function perpendicularDeterminant(point, p1, p2) {
	const mid = new SAT.Vector((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
	let slopePerp = -((p2.x - p1.x) / (p2.y - p1.y));
	let shifter = 1;
	if(isNaN(slopePerp) || !isFinite(slopePerp)) {
		slopePerp = -1;
		shifter = 0;
	}

	return determinant3x3([
		[mid.x, mid.y, 1],
		[mid.x + shifter, mid.y + slopePerp, 1],
		[point.x, point.y, 1]
	]);
}

async function extractMapChunks(tileMap) {
	const keyElementMask = TPAnalysis.createCustomTileMask(tileMap, {
		[TPAnalysis.TILE_IDS.WALL]: 1,
		[TPAnalysis.TILE_IDS.TLWALL]: 1,
		[TPAnalysis.TILE_IDS.TRWALL]: 1,
		[TPAnalysis.TILE_IDS.BLWALL]: 1,
		[TPAnalysis.TILE_IDS.BRWALL]: 1,

		[TPAnalysis.TILE_IDS.REDFLAG]: 3,
		[TPAnalysis.TILE_IDS.BLUEFLAG]: 3,

		[TPAnalysis.TILE_IDS.YELLOWFLAG]: 2,
		[TPAnalysis.TILE_IDS.BOOST]: 2,
		[TPAnalysis.TILE_IDS.REDBOOST]: 2,
		[TPAnalysis.TILE_IDS.BLUEBOOST]: 2,
		[TPAnalysis.TILE_IDS.POWERUP]: 2,
		[TPAnalysis.TILE_IDS.GATE]: 2,
		[TPAnalysis.TILE_IDS.BOMB]: 2,
		[TPAnalysis.TILE_IDS.PORTAL]: 2,
		[TPAnalysis.TILE_IDS.REDPORTAL]: 2,
		[TPAnalysis.TILE_IDS.BLUEPORTAL]: 2,
		[TPAnalysis.TILE_IDS.REDTEAMTILE]: 2,
		[TPAnalysis.TILE_IDS.BLUETEAMTILE]: 2,
		[TPAnalysis.TILE_IDS.YELLOWTEAMTILE]: 2,
	});

	let goals = [];
	const dialatedKeyElementMaskWithWalls = ndarray(new Float32Array(keyElementMask.data), keyElementMask.shape);

	for (let x = 0; x < keyElementMask.shape[0]; x++) {
		for (let y = 0; y < keyElementMask.shape[1]; y++) {
			const originColor = keyElementMask.get(x, y);

			if(originColor === 3) goals.push(new SAT.Vector(x, y));

			if(originColor > 1) {
				TPAnalysis.floodFill([x, y], {
					color: ([ox, oy], [nx, ny]) => {
						if(dialatedKeyElementMaskWithWalls.get(nx, ny) === 0) {
							dialatedKeyElementMaskWithWalls.set(nx, ny, originColor);
							return true;
						}

						return false;
					},
					radius: 1,
					diagonal: false
				});
			}
		}
	}

	const dialatedKeyElementMask = TPAnalysis.mapMatrix(dialatedKeyElementMaskWithWalls, x => {
		return x === 0 ? 0 : x - 1;
	});

	const impassibleMask = TPAnalysis.createCustomTileMask(tileMap, {
		[TPAnalysis.TILE_IDS.WALL]: 1,
		[TPAnalysis.TILE_IDS.TLWALL]: 1,
		[TPAnalysis.TILE_IDS.TRWALL]: 1,
		[TPAnalysis.TILE_IDS.BLWALL]: 1,
		[TPAnalysis.TILE_IDS.BRWALL]: 1,
		[TPAnalysis.TILE_IDS.SPIKE]: 1,
		[TPAnalysis.TILE_IDS.GATE]: 1,
		[TPAnalysis.TILE_IDS.PORTAL]: 1
	});

	// find closest outside impassible tile
	let outsideTilePoint = null;
	for (let x = 0; x < impassibleMask.shape[0]; x++) {
		for (let y = 0; y < impassibleMask.shape[1]; y++) {
			if(impassibleMask.get(x, y) === 1) {
				outsideTilePoint = new SAT.Vector(x, y);
				break;
			}
		}
		if(outsideTilePoint) break;
	}
	if(!outsideTilePoint) outsideTilePoint = new SAT.Vector(0, 0);

	TPAnalysis.floodFill([outsideTilePoint.x, outsideTilePoint.y], {
		color: ([ox, oy], [nx, ny]) => {
			if(impassibleMask.get(nx, ny) === 1) {
				impassibleMask.set(nx, ny, 2);
				return true;
			}

			return false;
		},
		radius: 1,
		diagonal: false
	});

	const morphologicalKeyElementMask = TPAnalysis.morphologicalMatrix(dialatedKeyElementMask);
	const chunkMask = await TPAnalysis.voronoiMatrix(morphologicalKeyElementMask);

	const labeledPoints = new Map();
	TPAnalysis.mapMatrix(chunkMask, (cell, [x, y]) => {
		if(tileMap.get(x, y) === TILE_IDS.BACKGROUND) return;
		if(!labeledPoints.has(cell)) labeledPoints.set(cell, []);
		labeledPoints.get(cell).push([x, y]);
		return;
	});

	const leftMostGoal = goals[0].x < goals[1].x ? goals[0] : goals[1];
	let determinerSign = -Math.sign(perpendicularDeterminant(leftMostGoal, goals[0], goals[1]));

	let mapChunks = [];
	for(const [label, points] of labeledPoints) {
		let mapChunk;
		try {
			mapChunk = makeMapChunk(tileMap, points);
		} catch(e) {
			console.log('Failed to make a chunk: ', e);
			continue;
		}
		let determiner = perpendicularDeterminant(mapChunk.positions.centerOfMass, goals[0], goals[1]) * determinerSign;

		if(determiner <= 0 || Math.round(determiner) <= 0) mapChunks.push(mapChunk);
	}

	const base = mapChunks.find(c => c.type === 'base');
	const mechs = mapChunks.filter(c => c.type === 'mech');

	if(base) {
		for(const mech of mechs) {
			mech.positions.flag = mech.positions.centerOfMass.clone().sub(base.features.flagPosition);
		}
	} else {
		console.warn('No Base Found');
	}

	return {chunkMask, mapChunks};
}

async function bufferStream(stream) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		stream.on('data', chunk => chunks.push(chunk));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', err => reject(err));
	});
}

Masher.extractMapChunks = extractMapChunks;
Masher.buildMapInfoFromMapID = buildMapInfoFromMapID;
Masher.serializeChunkModel = serializeChunkModel;
Masher.deserializeChunkModel = deserializeChunkModel;
Masher.loadChunkModel = loadChunkModel;

module.exports = Masher;
