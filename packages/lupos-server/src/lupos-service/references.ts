import type TS from 'typescript'
import {Template, TemplateProvider} from '../template-service'
import {
	TemplatePart,
	TemplatePartPiece,
	TemplatePartPieceType,
	TemplatePartType,
} from '../lupos-ts-module'
import {WorkSpaceAnalyzer} from './analyzer'


/** Add semantic template references to TypeScript reference groups. */
export class LuposReferences {

	constructor(
		private readonly analyzer: WorkSpaceAnalyzer,
		private readonly templateProvider: TemplateProvider
	) {}

	/** Provide reference service for template parts. */
	findReferences(
		part: TemplatePart,
		piece: TemplatePartPiece,
		template: Template
	): TS.ReferencedSymbol[] | undefined {
		let anchor: TS.Node | undefined

		if (part.type === TemplatePartType.Component && piece.type === TemplatePartPieceType.TagName) {
			anchor = this.analyzer.getComponentByTagName(part.node.tagName!, template)?.nameNode
		}
		else if (part.type === TemplatePartType.Property && piece.type === TemplatePartPieceType.Name) {
			let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
			anchor = component ? this.analyzer.getComponentProperty(component, part.mainName!)?.nameNode : undefined
		}
		else if (part.type === TemplatePartType.Binding && piece.type === TemplatePartPieceType.Name) {
			anchor = this.analyzer.getBindingByName(part.mainName!, template)?.nameNode
		}

		if (!anchor) {
			return undefined
		}

		anchor = this.getIdentifier(anchor)

		return this.analyzer.context.service.findReferences(
			anchor.getSourceFile().fileName,
			anchor.getStart()
		)
	}

	/** 
	 * Augment references symbols from lower typescript by
	 * all the references can be found in lupos templates.
	  */
	augment(symbols: TS.ReferencedSymbol[] | undefined): TS.ReferencedSymbol[] | undefined {
		if (!symbols || symbols.length === 0) {
			return symbols
		}

		let symbolsByDefinition = new Map<string, number[]>()
		symbols.forEach((symbol, index) => {
			let key = this.locationKey(symbol.definition.fileName, symbol.definition.textSpan)
			let indices = symbolsByDefinition.get(key) ?? []
			indices.push(index)
			symbolsByDefinition.set(key, indices)
		})

		let additions = symbols.map(() => [] as TS.ReferenceEntry[])
		for (let sourceFile of this.analyzer.context.program.getSourceFiles()) {
			for (let template of this.templateProvider.getAllTemplates(sourceFile.fileName)) {
				for (let part of template.parts) {
					let anchor = this.resolveCandidateAnchor(part, template)
					if (!anchor) {
						continue
					}

					anchor = this.getIdentifier(anchor)

					let anchorKey = this.locationKey(anchor.getSourceFile().fileName, {
						start: anchor.getStart(),
						length: anchor.getWidth(),
					})

					let symbolIndices = symbolsByDefinition.get(anchorKey)
					if (!symbolIndices) {
						continue
					}

					let references = this.makeTemplateReferences(part, template)
					for (let index of symbolIndices) {
						additions[index].push(...references)
					}
				}
			}
		}

		return symbols.map((symbol, index) => ({
			...symbol,
			references: this.deduplicate([...symbol.references, ...additions[index]]),
		}))
	}

	/** Resolve definition node by template part. */
	private resolveCandidateAnchor(part: TemplatePart, template: Template): TS.Node | undefined {
		if (part.type === TemplatePartType.Component) {
			return this.analyzer.getComponentByTagName(part.node.tagName!, template)?.nameNode
		}

		if (part.type === TemplatePartType.Property) {
			let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
			return component ? this.analyzer.getComponentProperty(component, part.mainName!)?.nameNode : undefined
		}

		if (part.type === TemplatePartType.Binding) {
			return this.analyzer.getBindingByName(part.mainName!, template)?.nameNode
		}

		return undefined
	}

	private makeTemplateReferences(part: TemplatePart, template: Template): TS.ReferenceEntry[] {
		let spans: TS.TextSpan[] = []

		if (part.type === TemplatePartType.Component) {
			spans.push({start: part.start, length: part.end - part.start})

			let tagName = part.node.tagName!
			let closingEnd = part.node.closureEnd
			let closingStart = closingEnd - tagName.length
			if (closingEnd >= 0 && template.content.slice(closingStart, closingEnd) === tagName) {
				spans.push({start: closingStart, length: tagName.length})
			}
		}
		else if (part.type === TemplatePartType.Property || part.type === TemplatePartType.Binding) {
			spans.push({
				start: part.start + (part.namePrefix?.length ?? 0),
				length: part.mainName?.length ?? 0,
			})
		}

		return spans
			.filter(span => span.length > 0)
			.map(span => ({
				fileName: template.fileName,
				textSpan: {
					start: template.localOffsetToGlobal(span.start),
					length: span.length,
				},
				isWriteAccess: false,
				isDefinition: false,
			}))
	}

	private getIdentifier(node: TS.Node): TS.Node {
		return this.analyzer.context.helper.getIdentifier(node) ?? node
	}

	private deduplicate(references: readonly TS.ReferenceEntry[]): TS.ReferenceEntry[] {
		let seen = new Set<string>()
		return references.filter(reference => {
			let key = this.locationKey(reference.fileName, reference.textSpan)
			if (seen.has(key)) {
				return false
			}

			seen.add(key)
			return true
		})
	}

	private locationKey(fileName: string, span: TS.TextSpan): string {
		return `${fileName.replace(/\\/g, '/').toLowerCase()}:${span.start}:${span.length}`
	}
}
