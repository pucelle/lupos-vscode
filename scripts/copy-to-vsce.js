// We copy files to package and publish because vsce package can't work with linked directory.

const fs = require('fs-extra')
const path = require('path')


// Copy to vsce
let fromDir = path.dirname(path.dirname(__filename))
let toDir = fromDir + '/vsce'
let excludeNames = [
	'.git',
	'.gitignore',
	'.gitmodules',
	'.vscode',
	'.VSCodeCounter',
	'packages',
	'vsce',
	'tsconfig.json',
	'tsconfig.tsbuildinfo',
	'src',
	'copy-to-vsce.js',
	'package-lock.json',
	'tests',
	'vitest.config.mts',
	'scripts',
]

fs.ensureDirSync(toDir)

let fileOrFolderNames = fs.readdirSync(fromDir)
fileOrFolderNames = fileOrFolderNames.filter(v => !excludeNames.includes(v))

for (let fileOrFolderName of fileOrFolderNames) {
	let targetPath = path.resolve(toDir, fileOrFolderName)
	if (path.dirname(targetPath) !== path.resolve(toDir)) {
		throw new Error(`Refusing to replace path outside VSCE staging: ${targetPath}`)
	}

	// Replace staged roots so renamed and deleted build outputs can't survive packaging.
	fs.removeSync(targetPath)
	fs.copySync(fromDir + '/' + fileOrFolderName, targetPath, {dereference: true})
}

cleanPackageJSON(toDir)
cleanPackageJSON(toDir + '/node_modules/lupos-server')


function cleanPackageJSON(dir) {
	let packageJson = fs.readJSONSync(dir + '/package.json')
	delete packageJson.scripts
	delete packageJson.devDependencies
	fs.writeJSONSync(dir + '/package.json', packageJson, {spaces: '\t'})
}
