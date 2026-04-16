import type TS from 'typescript'
import {ListMap, LuposBinding, LuposComponent} from '../../lupos-ts-module'
import {ProjectContext, ts} from '../../core'
import * as path from 'node:path'


export type ExportedMembers = Map<string, TS.SourceFile>

export interface ImportPathAndTextChange {
	importPath: string
	textChange: TS.FileTextChanges
}


/** 
 * Analyze import paths of a source file.
 * And can get text edit for importing a specified member.
 */
export class ExportsAnalyzer {

	/** Analyzed components by source file. */
	private componentsByFile: ListMap<TS.SourceFile, LuposComponent>

	/** Analyzed bindings by source file. */
	private bindingsByFile: ListMap<TS.SourceFile, LuposBinding>

	private context: ProjectContext
	private analyzed: Map<TS.SourceFile, ExportedMembers> = new Map()

	constructor(
		componentsByFile: ListMap<TS.SourceFile, LuposComponent>,
		bindingsByFile: ListMap<TS.SourceFile, LuposBinding>,
		context: ProjectContext
	) {
		this.componentsByFile = componentsByFile
		this.bindingsByFile = bindingsByFile
		this.context = context
	}

	/** Delete source file. */
	delete(sourceFile: TS.SourceFile) {
		this.analyzed.delete(sourceFile)
	}

	/** Analyze for all the component or binding members imported or declared. */
	analyze(sourceFile: TS.SourceFile): ExportedMembers {
		if (this.analyzed.has(sourceFile)) {
			return this.analyzed.get(sourceFile)!
		}

		let map: ExportedMembers = new Map()
		let components = this.componentsByFile.get(sourceFile)
		let bindings = this.bindingsByFile.get(sourceFile)

		if (components) {
			for (let component of components) {
				map.set(component.name, sourceFile)
			}
		}

		if (bindings) {
			for (let binding of bindings) {
				map.set(binding.name, sourceFile)
			}
		}

		// Set it early to avoid circular reference.
		this.analyzed.set(sourceFile, map)

		// Only visit root children.
		ts.forEachChild(sourceFile, (node: TS.Node) => {
			if (ts.isExportDeclaration(node)) {
				this.analyzeExportDeclaration(node, map)
			}
		})

		return map
	}

	private analyzeExportDeclaration(node: TS.ExportDeclaration, map: ExportedMembers) {
		let helper = this.context.helper

		let targetPath = node.moduleSpecifier ? helper.getText(node.moduleSpecifier) : undefined
		if (!targetPath) {
			return
		}

		let sourceFile = node.getSourceFile()
		let targetSourceFilePath = path.join(path.dirname(sourceFile.fileName), targetPath)
		let targetSourceFile = this.resolveSourceFile(targetSourceFilePath)

		if (!targetSourceFile) {
			return
		}

		let targetExportedMembers = this.analyze(targetSourceFile)

		// export {a} from 'b'
		if (node.exportClause && ts.isNamedExports(node.exportClause)) {
			for (let element of node.exportClause.elements) {
				let fromProperty = helper.getText(element.propertyName ?? element.name)
				let toName = helper.getText(element.name)
				let fromSourceFile = targetExportedMembers.get(fromProperty)

				if (fromSourceFile) {
					map.set(toName, fromSourceFile)
				}
			}
		}

		// export * from 'b'
		else if (!node.exportClause) {
			for (let [fromName, fromSourceFile] of targetExportedMembers) {
				map.set(fromName, fromSourceFile)
			}
		}
	}

	private resolveSourceFile(targetPath: string): TS.SourceFile | undefined {
		let sourceFile = this.resolveSourceFileBySpecifiedPath(targetPath + '.ts')
		if (sourceFile) {
			return sourceFile
		}

		sourceFile = this.resolveSourceFileBySpecifiedPath(targetPath + '/index.ts')
		if (sourceFile) {
			return sourceFile
		}

		sourceFile = this.resolveSourceFileBySpecifiedPath(targetPath + '/index.d.ts')
		if (sourceFile) {
			return sourceFile
		}

		return undefined
	}

	private resolveSourceFileBySpecifiedPath(targetPath: string): TS.SourceFile | undefined {
		return this.context.program.getSourceFile(path.normalize(targetPath).replace(/\\/g, '/'))
	}

	/** Get text edits for import a specified member from a source file. */
	getImportPathAndTextChangeList(memberName: string, targetSourceFile: TS.SourceFile, fromSourceFile: TS.SourceFile): ImportPathAndTextChange[] {
		let list: ImportPathAndTextChange[] = []
		let importPaths = this.getImportPaths(memberName, targetSourceFile, fromSourceFile)

		if (importPaths.length === 0) {
			return list
		}

		for (let importPath of importPaths) {
			let textChange = this.makeTextChange(memberName, importPath, fromSourceFile)
			if (textChange) {
				list.push({
					textChange,
					importPath,
				})
			}
		}

		return list
	}

	/** When want to import `targetSourceFile` from `fromSourceFile`, get the best import path. */
	getImportPaths(memberName: string, targetSourceFile: TS.SourceFile, fromSourceFile: TS.SourceFile): string[] {
		let fromFilePath = fromSourceFile.fileName
		let targetFilePath = targetSourceFile.fileName
		let availablePaths = this.getRelativeImportPaths(memberName, targetFilePath, fromFilePath)

		// Replace to shorter paths by alias.
		if (availablePaths.length > 0 && availablePaths[0].includes('node_modules/')) {
			let options = this.context.program.getCompilerOptions()
			let host = ts.createCompilerHost(options)

			for (let i = 0; i < availablePaths.length; i++) {
				let availablePath = availablePaths[i]
				let shorterPath = availablePath.replace(/.+?node_modules\//, '')

				if (ts.resolveModuleName(shorterPath, fromFilePath, options, host).resolvedModule) {
					availablePaths[i] = shorterPath
				}
			}
		}
		
		// Import whole module from node_modules.
		if (targetFilePath.includes('/node_modules/')) {
			let moduleName = targetFilePath.match(/\/node_modules\/((?:@[^\/]+\/)?[^\/]+)/)?.[1]
			if (moduleName) {
				availablePaths.push(moduleName)
			}
		}

		return availablePaths
	}

	private getRelativeImportPaths(memberName: string, targetFilePath: string, fromFilePath: string): string[] {
		let fromDirPath = path.dirname(fromFilePath)
		let relativePath = path.relative(fromDirPath, targetFilePath).replace(/\\/g, '/')
		let availablePaths: string[] = []

		// Absolute path, ignores it.
		if (path.isAbsolute(relativePath)) {
			return []
		}

		// Import path must starts with `./`.
		if (!relativePath.startsWith('.')) {
			relativePath = './' + relativePath
		}

		let availablePath = relativePath.replace(/(?:\/index)?(?:\.d)?\.ts$/, '')
		availablePaths.push(availablePath)

		let relativePathPieces = relativePath.split('/')
		
		// From longer relative path to shorter.
		for (let i = relativePathPieces.length - 2; i >= 0; i--) {
			let piece = relativePathPieces[i]
			if (piece === '..' || piece === '.') {
				break
			}

			let relativePath = relativePathPieces.slice(0, i + 1).join('/')
			let absolutePath = path.join(fromDirPath, relativePath)
			let sourceFile = this.resolveSourceFile(absolutePath)

			if (!sourceFile) {
				continue
			}

			let memberMap = this.analyze(sourceFile)
			if (memberMap.has(memberName)) {
				availablePaths.push(relativePath)
			}
		}

		return availablePaths
	}

	private makeTextChange(memberName: string, importPath: string, fromSourceFile: TS.SourceFile): TS.FileTextChanges | undefined {
		let helper = this.context.helper
		let existingImport = this.context.helper.imports.getImportFromModule(importPath, fromSourceFile)
		let start: number
		let insertText: string

		if (existingImport
			&& existingImport.importClause?.namedBindings
			&& ts.isNamedImports(existingImport.importClause.namedBindings)
		) {
			let namedBindings = existingImport.importClause.namedBindings
			let elements = namedBindings.elements

			// Have been imported.
			if (elements.find(el => helper.getText(el.name) === memberName)) {
				return undefined
			}

			let lastSpecifier = elements.length > 0 ? elements[elements.length - 1] : undefined
			if (lastSpecifier) {
				let spaces = ' '

				if (lastSpecifier.getFullStart() < lastSpecifier.getStart()) {
					let text = fromSourceFile.text
					spaces = text.slice(lastSpecifier.getFullStart(), lastSpecifier.getStart())
				}

				start = lastSpecifier.end
				insertText = ',' + spaces + memberName
			}
			else {
				start = namedBindings.end - 1
				insertText = memberName
			}
		}
		else {
			let nodeAfterLastStatement = fromSourceFile.statements.find(stat => !ts.isImportDeclaration(stat))
			let importText = `import {${memberName}} from '${importPath}'`

			if (nodeAfterLastStatement) {
				start = nodeAfterLastStatement.getFullStart()
				insertText = '\n' + importText
			}
			else {
				start = 0
				insertText = importText + '\n'
			}
		}

		return {
			fileName: fromSourceFile.fileName,
			textChanges: [{
				span: {
					start,
					length: 0,
				},
				newText: insertText,
			}],
		}
	}
}