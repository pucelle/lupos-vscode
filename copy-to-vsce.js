// We copy files to package and publish because vsce package can't work with linked directory.

const fs = require('fs-extra')
const path = require('path')


// Copy to vsce
let fromDir = path.dirname(__filename)
let toDir = path.dirname(__filename) + '/vsce'
let excludeNames = ['.gitignore', '.gitmodules', '.vscode', '.git', 'packages', 'vsce', 'tsconfig.json', 'tsconfig.tsbuildinfo', 'src', 'copy-to-vsce.js', 'package-lock.json']

fs.ensureDirSync(toDir)

let fileOrFolderNames = fs.readdirSync(fromDir)
fileOrFolderNames = fileOrFolderNames.filter(v => !excludeNames.includes(v))

for (let fileOrFolderName of fileOrFolderNames) {
	fs.copySync(fromDir + '/' + fileOrFolderName, toDir + '/' + fileOrFolderName, {dereference: true})
}


let packageJson = fs.readJSONSync(toDir + '/package.json')
delete packageJson.scripts
delete packageJson.devDependencies
fs.writeJSONSync(toDir + '/package.json', packageJson, {spaces: '\t'})