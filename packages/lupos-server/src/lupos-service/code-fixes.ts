import type * as TS from 'typescript'
import {WorkSpaceAnalyzer} from './analyzer'
import {DiagnosticCode, TemplatePart, TemplatePartPiece, TemplatePartPieceType, TemplatePartType} from '../lupos-ts-module'
import {Template} from '../template-service'
import {ProjectContext} from '../core'


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
		
		let component = this.analyzer.getWorkspaceComponentByName(tagName)
		if (!component) {
			return undefined
		}

		let changeAndPath = this.analyzer.exports.getImportPathAndTextChange(component.name, component.sourceFile, template.sourceFile)
		if (!changeAndPath) {
			return undefined
		}

		let fileTextChange = changeAndPath.textChange
		let importPath = changeAndPath.importPath

		return [{
			fixName: `Update import`,
			description: `Update import from "${importPath}"`,
			changes: [fileTextChange],
		}]
	}

	private getCodeFixOfBinding(part: TemplatePart, template: Template): TS.CodeFixAction[] | undefined {
		let mainName = part.mainName!
		let binding = this.analyzer.getWorkspaceBindingByName(mainName)

		if (!binding) {
			return undefined
		}

		let changeAndPath = this.analyzer.exports.getImportPathAndTextChange(binding.name, binding.sourceFile, template.sourceFile)
		if (!changeAndPath) {
			return undefined
		}

		let change = changeAndPath.textChange
		let importPath = changeAndPath.importPath

		return [{
			fixName: `Update import`,
			description: `Update import from "${importPath}"`,
			changes: [change],
		}]
	}
}
