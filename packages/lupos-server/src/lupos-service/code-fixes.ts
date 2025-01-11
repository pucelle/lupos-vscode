import type * as TS from 'typescript'
import {WorkSpaceAnalyzer} from './analyzer'
import {DiagnosticCode, TemplatePart, TemplatePartPiece, TemplatePartPieceType, TemplatePartType} from '../lupos-ts-module'
import {Template} from '../template-service'
import {ProjectContext, ts} from '../core'
import * as path from 'node:path'


/** Provide lupos code-fix service. */
export class LuposCodeFixes {

	readonly analyzer: WorkSpaceAnalyzer
	readonly context: ProjectContext

	constructor(analyzer: WorkSpaceAnalyzer) {
		this.analyzer = analyzer
		this.context = analyzer.context
	}
	
	getCodeFixes(part: TemplatePart, piece: TemplatePartPiece, template: Template, errorCodes: ReadonlyArray<number>): TS.CodeFixAction[] | undefined {

		// `<A`
		if (part.type === TemplatePartType.Component) {
			if (errorCodes.includes(DiagnosticCode.MissingImportOrDeclaration)) {
				return this.getCodeFixOfComponent(part, template)
			}
		}

		// `<A`
		else if (part.type === TemplatePartType.Binding) {
			if (piece.type === TemplatePartPieceType.Name
				&& errorCodes.includes(DiagnosticCode.MissingImportOrDeclaration)
			) {
				return this.getCodeFixOfBinding(part, template)
			}
		}

		return undefined
	}
	
	private getCodeFixOfComponent(part: TemplatePart, template: Template): TS.CodeFixAction[] | undefined {
		let tagName = part.node.tagName!
		
		let component = this.analyzer.getWorkspaceComponentsByName(tagName)?.[0]
		if (!component) {
			return undefined
		}

		let importPath = this.getImportPath(component.declaration, template)
		if (!importPath) {
			return undefined
		}

		let change = this.makeFileTextChange(component.name, importPath, template.sourceFile)
		if (!change) {
			return undefined
		}

		return [{
			fixName: `Update import`,
			description: `Update import from "${importPath}"`,
			changes: [change],
		}]
	}

	private getCodeFixOfBinding(part: TemplatePart, template: Template): TS.CodeFixAction[] | undefined {
		let mainName = part.mainName!
		let binding = this.analyzer.getBindingByName(mainName, template)

		if (!binding) {
			return undefined
		}

		let importPath = this.getImportPath(binding.declaration, template)
		if (!importPath) {
			return undefined
		}

		let change = this.makeFileTextChange(binding.name, importPath, template.sourceFile)
		if (!change) {
			return undefined
		}

		return [{
			fixName: `Update import`,
			description: `Update import from "${importPath}"`,
			changes: [change],
		}]
	}

	// /** Can be a module name, or a relative path name. */
	private getImportPath(decl: TS.ClassDeclaration, template: Template): string | undefined {
		let targetSourceFile = decl.getSourceFile()
		let targetFilePath = targetSourceFile.fileName
		let currentFilePath = template.sourceFile.fileName

		if (targetFilePath.includes('/node_modules/')) {
			return targetFilePath.match(/^.+\/node_modules\/([^\/]+)/)?.[1]
		}
		else {
			let relativePath = path.relative(path.dirname(currentFilePath), targetFilePath)
			if (!relativePath) {
				return undefined
			}

			// From current file.
			if (relativePath === '.') {
				return relativePath
			}

			let relativePathPieces = relativePath.split('/')
			let availablePath = relativePath

			for (let i = relativePathPieces.length - 2; i >= 0; i--) {
				let piece = relativePathPieces[i]
				if (piece === '..' || piece === '.') {
					break
				}

				for (let fileName of ['index.ts', 'index.d.ts']) {
					let relativeIndexPath = relativePathPieces.slice(0, i).join('/') + '/' + fileName
					let indexPath = path.normalize(path.join(currentFilePath, relativeIndexPath))
	
					if (indexPath && this.context.program.getSourceFile(indexPath)) {
						availablePath = relativeIndexPath
						break
					}
				}
			}

			availablePath = availablePath.replace(/(?:\/index)?(?:\.d)?\.ts$/, '')

			return availablePath
		}
	}

	private makeFileTextChange(referenceName: string, importPath: string, sourceFile: TS.SourceFile): TS.FileTextChanges | undefined {
		let existingImport = this.context.helper.imports.getImportFromModule(importPath, sourceFile)
		let start: number
		let insertText: string

		if (existingImport
			&& existingImport.importClause?.namedBindings
			&& ts.isNamedImports(existingImport.importClause.namedBindings)
		) {
			let namedBindings = existingImport.importClause.namedBindings
			let elements = namedBindings.elements
			let lastSpecifier = elements.length > 0 ? elements[elements.length - 1] : undefined

			if (lastSpecifier) {
				let spaces = ' '

				if (lastSpecifier.getFullStart() < lastSpecifier.getStart()) {
					let text = sourceFile.text
					spaces = text.slice(lastSpecifier.getFullStart(), lastSpecifier.getStart())
				}

				start = lastSpecifier.end
				insertText = ',' + spaces + referenceName
			}
			else {
				start = namedBindings.end - 1
				insertText = referenceName
			}
		}
		else {
			let nodeAfterLastStatement = sourceFile.statements.find(stat => !ts.isImportDeclaration(stat))
			let importText = `import {${referenceName}} from '${importPath}'`

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
			fileName: sourceFile.fileName,
			textChanges: [{
				span: {
					start,
					length: 0,
				},
				newText: insertText,
			}],
		}
	}

	// private makeCodeFix(item: QuickInfoItem | undefined, part: TemplatePart, piece: TemplatePartPiece): TS.CodeFixAction | undefined{
	// 	if (!item || (!item.type && !item.description)) {
	// 		return undefined
	// 	}

	// 	let kind = getScriptElementKind(item, part, piece)

	// 	let textSpan: TS.TextSpan = {
	// 		start: part.start,
	// 		length: part.end - part.start,
	// 	}

	// 	let headers: TS.SymbolDisplayPart[] = []
	// 	let documentation: TS.SymbolDisplayPart[] = []

	// 	let headerText = piece.type === TemplatePartPieceType.TagName
	// 		? part.node.tagName!
	// 		: (part.namePrefix || '') + part.mainName!

	// 	if (part.type === TemplatePartType.Component) {
	// 		headerText = '<' + headerText + '>'
	// 	}
	// 	else if (item.type) {
	// 		headerText += ': ' + this.context.helper.types.getTypeFullText(item.type)
	// 	}

	// 	headers.push({
	// 		kind: this.context.helper.ts.SymbolDisplayPartKind[getSymbolDisplayPartKind(part, piece)],
	// 		text: headerText,
	// 	})

	// 	if (item.description) {
	// 		documentation.push({
	// 			kind: 'text',
	// 			text: item.description,
	// 		})
	// 	}

	// 	let info: TS.QuickInfo = {
	// 		kind,
	// 		kindModifiers: '',
	// 		textSpan,
	// 		displayParts: headers,
	// 		documentation,
	// 	}

	// 	return info
	// }
}
