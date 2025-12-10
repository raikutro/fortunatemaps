#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { pack } = require('msgpackr');

const Masher = require('./masher');

const DEFAULT_MODEL_DIR = path.join(__dirname, '..', 'chunk_models');

const usage = `
Usage:
  node components/train_model.js --file path/to/map_ids.txt [--out my_model.chunk]
  node components/train_model.js 1,2,3,4 [--out /absolute/output/path/my_model.chunk]

Options:
  --file <path>     Read comma or newline delimited map IDs from a file.
  --out <path>      Output file path (relative to chunk_models unless absolute).

Map IDs can also be provided directly as a comma-separated list of IDs.
`;

async function main() {
	const { mapIDs, outFile, error } = await parseArgs();
	if(error) {
		console.error(error);
		process.exit(1);
	}

	if(!mapIDs.length) {
		console.error('No map IDs provided.');
		console.log(usage.trim());
		process.exit(1);
	}

	const { dir: resolvedOutDir, file: resolvedOutFile } = resolveOutputPath(outFile);
	await fs.mkdir(resolvedOutDir, { recursive: true });

	console.log(`Building chunk model for ${mapIDs.length} map(s)...`);
	renderProgress(0, mapIDs.length, "starting");

	const mapInfos = [];
	for(let i = 0; i < mapIDs.length; i++) {
		const mapID = mapIDs[i];
		renderProgress(i, mapIDs.length, `Analyzing map ${mapID}`);
		try {
			const mapInfo = await Masher.buildMapInfoFromMapID(mapID);
			mapInfos.push(mapInfo);
		} catch(err) {
			console.error(`\nFailed to build map info for map ${mapID}:`, err.message || err);
		}
	}

	if(!mapInfos.length) {
		process.stdout.write('\nNo map info generated.\n');
		process.exit(1);
	}

	const serializedModel = Masher.serializeChunkModel(mapInfos);
	const outputPath = resolvedOutFile || path.join(
		resolvedOutDir,
		`chunk_model_${mapInfos.length}maps_${Date.now()}.chunk`
	);

	await fs.writeFile(outputPath, pack(serializedModel));

	process.stdout.write(`\nSaved chunk model to ${outputPath}\n`);
}

async function parseArgs() {
	const args = process.argv.slice(2);
	if(args.length === 0) return { mapIDs: [], outFile: null, error: null };

	let outFile = null;
	let idsArg = null;
	for(let i = 0; i < args.length; i++) {
		const arg = args[i];
		if(arg === '--file' || arg === '-f') {
			idsArg = { type: 'file', value: args[i + 1] };
			i++;
		} else if(arg === '--out' || arg === '-o') {
			outFile = args[i + 1];
			i++;
		} else if(!idsArg) {
			idsArg = { type: 'inline', value: arg };
		}
	}

	if(!idsArg) return { mapIDs: [], outFile, error: null };

	if(idsArg.type === 'file') {
		if(!idsArg.value) return { mapIDs: [], outDir, error: 'Missing file path after --file.' };
		try {
			const raw = await fs.readFile(idsArg.value, 'utf8');
			return { mapIDs: parseIDList(raw), outFile, error: null };
		} catch(err) {
			return { mapIDs: [], outFile, error: `Unable to read file: ${err.message || err}` };
		}
	}

	return { mapIDs: parseIDList(idsArg.value), outFile, error: null };
}

function resolveOutputPath(outFile) {
	if(!outFile) return { dir: DEFAULT_MODEL_DIR, file: null };

	const hasChunkExtension = outFile.toLowerCase().endsWith('.chunk');
	const fileWithExt = hasChunkExtension ? outFile : `${outFile}.chunk`;

	if(path.isAbsolute(fileWithExt)) {
		return { dir: path.dirname(fileWithExt), file: fileWithExt };
	}

	const fullPath = path.join(DEFAULT_MODEL_DIR, fileWithExt);
	return { dir: path.dirname(fullPath), file: fullPath };
}

function parseIDList(raw) {
	return raw
		.split(/[\s,]+/)
		.map(s => s.trim())
		.filter(Boolean)
		.map(val => {
			const num = Number(val);
			return Number.isFinite(num) ? num : val;
		});
}

function renderProgress(current, total, comment="") {
	const width = 30;
	const ratio = total === 0 ? 1 : current / total;
	const filled = Math.round(ratio * width);
	const bar = `[${'#'.repeat(filled)}${'.'.repeat(Math.max(width - filled, 0))}] ${current}/${total}`;
	const suffix = comment ? ` ${comment}` : '';
	process.stdout.write(`\r${bar}`);
	if(suffix) process.stdout.write(suffix);
}

main();
