const TPAnalysis = require('./tp_analysis').default;
const PreviewGenerator = require('./preview_generator');
const optimize = require('gradient-descent')
const createHull = require('hull');
const { buffer } = require('node:stream/consumers');
const savePixels = require("save-pixels");
const SAT = require('sat');
const { createWriteStream, writeFileSync } = require('fs');
const { mapIDToTileMap, colorize, ndarray, matrixToHTML, TILE_IDS, TILE_COLORS, SYMMETRY } = TPAnalysis;

const Masher = {};

const OPTIMIZER_SETTINGS = {
	CHUNK_HULL_CONCAVITY: 3.5,
	DEFAULT_NUMBER_OF_MECHANICS: 4
};

Masher.mashMaps = async (mapIDs) => {
	const mapInfos = await Promise.all(mapIDs.map(async (m) => {
		const tileMap = await mapIDToTileMap(m);
		const { chunkMask, mapChunks, debug } = await extractMapChunks(tileMap);
		return {
			tileMap,
			chunkMask,
			mapChunks,
			debug
		};
	}));

	const testMap = mapInfos[0].mapChunks[1].tiles;

	const mapJSON = {
		"info":{"name":"Some Map","author":"Anonymous","gameMode":"normal"},
		"switches":{},"fields":{},"portals":{},"marsballs":[],"spawnPoints":{"red":[],"blue":[]}
	};

	const allChunks = mapInfos.map(mI => mI.mapChunks).flat();
	const numberOfMechs = OPTIMIZER_SETTINGS.DEFAULT_NUMBER_OF_MECHANICS;
	shuffleArray(allChunks);

	const mapSize = new SAT.Vector(...[
		mapInfos.reduce((a, m) => a + m.tileMap.shape[0], 0),
		mapInfos.reduce((a, m) => a + m.tileMap.shape[1], 0)
	].map(a => a / mapInfos.length));
	const chosenBase = allChunks.find(c => c.type === 'base');
	const chosenMechs = allChunks.filter(c => c.type === 'mech').slice(0, numberOfMechs);

	for (let i = 0; i < chosenMechs.length; i++) {
		savePixels(colorize(chosenMechs[i].tiles, TILE_COLORS), "png").pipe(createWriteStream(`./mechs/mech_${i}.png`, {
			autoClose: true,
			flags: 'w'
		}));
	}

	const optimizer = new MapOptimizer(mapSize, SYMMETRY.ROTATIONAL, chosenBase, chosenMechs);
	// console.log(optimizer.cost(optimizer.getInitialOptimizationVector().map(v => v + Math.random() * 50 - 25)));

	console.log(await optimizer.optimize());

	const hullPolygons = optimizer.shapes.map(s => s.hull.calcPoints.map(p => [p.x, p.y]));

	const baseSVG = TPAnalysis.createBaseDocument(mapInfos[0].tileMap.shape[0], mapInfos[0].tileMap.shape[1]);
	TPAnalysis.addMapPreviewLayer(baseSVG, mapIDs[0]);
	TPAnalysis.addMatrixLayer(baseSVG, mapInfos[0].chunkMask);
	TPAnalysis.addPolygonLayer(baseSVG, hullPolygons);
	baseSVG.css({
		width: '75vw',
		height: 'auto',
	});

	writeFileSync('view.html', `
		${baseSVG.svg()}
		${matrixToHTML(testMap)}
	`);

	return mapInfos;
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
		this.updateShapes(this.getInitialOptimizationVector(), true);

		this.lowestCost = Infinity;
		this.bestVector = this.getInitialOptimizationVector();
	}

	generateAffinities() {
		for(const shape of this.shapes) {
			if(shape.chunk.type === 'base') {
				shape.affinity = shape.chunk.positions.centerOfMass;
			} else {
				const flagAffinity = this.base.features.flagPosition.clone().add(shape.chunk.positions.flag);
				const centerAffinity = shape.chunk.positions.centerOfMass;
				shape.affinity = pointAverage([flagAffinity, centerAffinity]);
			}
		}
	}

	getInitialOptimizationVector() {
		return this.shapes.map(s => [s.affinity.x, s.affinity.y]).flat();
	}

	getOptimizationVector() {
		return this.shapes.map(s => [s.hull.offset.x, s.hull.offset.y]).flat();
	}

	updateShapes(vector, setBase=false) {
		for(let i = 0; i < this.shapes.length; i++) {
			if(setBase && this.shapes[i].chunk.type === 'base') continue;
			this.shapes[i].hull.setOffset(new SAT.Vector(
				vector[i * 2],
				vector[i * 2 + 1]
			));
		}
	}

	cost(vector) {
		let cost = 0;

		const currentVector = this.getOptimizationVector();

		this.updateShapes(vector);

		const response = new SAT.Response();

		for(const shape of this.shapes) {
			const distFromAffinity = shape.hull.offset.clone().sub(shape.affinity).len();
			cost += distFromAffinity;

			for(const point of shape.hull.calcPoints) {
				if(!SAT.pointInPolygon(point, this.boundingPolygon)) {
					cost += 1000;
				}
			}

			for(const shape2 of this.shapes) {
				if(shape.id === shape2.id) continue;
				const collided = SAT.testPolygonPolygon(shape.hull, shape2.hull, response);
				if(!collided) continue;

				cost += response.overlap ** 4;
				response.clear();
			}
		}

		this.updateShapes(currentVector);

		if(cost < this.lowestCost) {
			this.lowestCost = cost;
			this.bestVector = vector;
		}

		return cost;
	}

	formattedCost(...vector) {
		return this.cost(vector);
	}

	async optimize() {
		const initialVector = this.getInitialOptimizationVector();
		const optimizedVector = await optimize(
			initialVector, this.formattedCost.bind(this),
			1, 0.1, 3000, 1
		);

		this.updateShapes(this.bestVector);

		return {
			vector: this.bestVector,
			cost: this.cost(this.bestVector)
		};
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

	const chunkHullPoints = createHull(tileCenterPoints, OPTIMIZER_SETTINGS.CHUNK_HULL_CONCAVITY).map(p => new SAT.Vector(...p));
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

function convertMapChunkPositionsToRelative(tileMap, mapChunk) {
	for(const [key, value] of Object.entries(mapChunk.positions)) {
		mapChunk.positions[key] = value.clone().scale(
			1 / tileMap.shape[0], 1 / tileMap.shape[1]
		);
	}
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

	const goals = [];
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

	const morphologicalKeyElementMask = TPAnalysis.morphologicalMatrix(dialatedKeyElementMask);
	const chunkMask = await TPAnalysis.voronoiMatrix(morphologicalKeyElementMask);

	const labeledPoints = new Map();
	TPAnalysis.mapMatrix(chunkMask, (cell, [x, y]) => {
		if(tileMap.get(x, y) === TILE_IDS.BACKGROUND) return;
		if(!labeledPoints.has(cell)) labeledPoints.set(cell, []);
		labeledPoints.get(cell).push([x, y]);
		return;
	});

	const mapCenter = new SAT.Vector(tileMap.shape[0] / 2, tileMap.shape[1] / 2);

	let mapChunks = [];
	for(const [label, points] of labeledPoints) {
		let mapChunk = makeMapChunk(tileMap, points);
		const determiner = perpendicularDeterminant(mapChunk.positions.centerOfMass, goals[0], goals[1]);
		if(determiner <= 0 || Math.round(determiner) <= 0) {
			// convertMapChunkPositionsToRelative(tileMap, mapChunk);
			mapChunks.push(mapChunk);
		}
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

module.exports = Masher;