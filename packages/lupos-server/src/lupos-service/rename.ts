import type TS from 'typescript'
import {Template, TemplateProvider} from '../template-service'
import {
	LuposBinding,
	LuposComponent,
	LuposProperty,
	parseAllTemplatePartPieces,
	TemplatePart,
	TemplatePartPiece,
	TemplatePartPieceType,
	TemplatePartType,
} from '../lupos-ts-module'
import {WorkSpaceAnalyzer} from './analyzer'


type RenameItem = LuposComponent | LuposProperty | LuposBinding

interface RenameTarget {
	anchor: TS.Node
	item: RenameItem
	kind: TemplatePartType.Component | TemplatePartType.Property | TemplatePartType.Binding
}


/** Rename semantic Lupos names while keeping TypeScript's symbol rules authoritative. */
export class LuposRename {

	constructor(
		private readonly analyzer: WorkSpaceAnalyzer,
		private readonly templateProvider: TemplateProvider
	) {}

	/** 
	 * Resolves the template component/property/binding to its TypeScript symbol,
	 * asks TypeScript for rename info, checks node_modules,
	 * and replaces triggerSpan with the template name span.
	 */
	modifyRenameInfo(fileName: string, position: number, info: TS.RenameInfo): TS.RenameInfo {
		if (!info.canRename) {
			return info
		}

		let references = this.analyzer.context.service.findReferences(fileName, position) ?? []

		let referencedFiles = references.flatMap(symbol => [
			symbol.definition.fileName,
			...symbol.references.map(reference => reference.fileName),
		])

		if (this.isNodeModules(fileName) || referencedFiles.some(referenceFile => this.isNodeModules(referenceFile))) {
			return {
				canRename: false,
				localizedErrorMessage: 'Cannot rename this symbol because it has references in node_modules.',
			}
		}

		return info
	}

	/**
	 * Receives TypeScript’s existing RenameInfo and only adds the Lupos-specific node_modules denial.
	 * It preserves TypeScript’s original trigger span and other metadata.
	 */
	getRenameInfo(
		part: TemplatePart,
		piece: TemplatePartPiece,
		template: Template,
		preferences?: TS.UserPreferences | TS.RenameInfoOptions
	): TS.RenameInfo | undefined {
		let target = this.resolveTarget(part, piece, template)
		if (!target) {
			return undefined
		}

		let anchor = this.getIdentifier(target.anchor)
		let service = this.analyzer.context.service

		let info = service.getRenameInfo(anchor.getSourceFile().fileName, anchor.getStart(), preferences as TS.UserPreferences)
		if (!info.canRename) {
			return info
		}

		let locations = this.collectRenameLocations(target, false, false, preferences as TS.UserPreferences)
		if (locations.denied) {
			return {
				canRename: false,
				localizedErrorMessage: 'Cannot rename this symbol because it has references in node_modules.',
			}
		}

		return {
			...info,
			triggerSpan: this.getPartNameSpan(part),
		}
	}

	/** 
	 * Uses those locations as symbol anchors, scans templates,
	 * and appends matching component/property/binding locations.
	 */
	augmentRenameLocations(
		fileName: string,
		position: number,
		rawLocations: readonly TS.RenameLocation[] | undefined
	): readonly TS.RenameLocation[] | undefined {
		if (!rawLocations) {
			return undefined
		}

		let locations = [...rawLocations]
		let anchorKeys = new Set(rawLocations.map(location => this.locationKey(location.fileName, location.textSpan)))

		let kinds = [
			TemplatePartType.Component,
			TemplatePartType.Property,
			TemplatePartType.Binding,
		] as const

		for (let sourceFile of this.analyzer.context.program.getSourceFiles()) {
			for (let template of this.templateProvider.getAllTemplates(sourceFile.fileName)) {
				for (let kind of kinds) {
					locations.push(...this.getTemplateLocations(template, kind, anchorKeys))
				}
			}
		}

		locations = this.deduplicate(locations)

		let references = this.analyzer.context.service.findReferences(fileName, position) ?? []

		let referencedFiles = references.flatMap(symbol => [
			symbol.definition.fileName,
			...symbol.references.map(reference => reference.fileName),
		])

		let denied = this.isNodeModules(fileName)
			|| referencedFiles.some(referenceFile => this.isNodeModules(referenceFile))
			|| locations.some(location => this.isNodeModules(location.fileName))

		return denied ? undefined : locations
	}

	/**
	 * Resolves the template name to a TypeScript symbol,
	 * asks TypeScript for its locations,
	 * then adds matching template locations.
	 */
	findRenameLocations(
		part: TemplatePart,
		piece: TemplatePartPiece,
		template: Template,
		findInStrings: boolean,
		findInComments: boolean,
		preferences?: boolean | TS.UserPreferences
	): readonly TS.RenameLocation[] | undefined {
		let target = this.resolveTarget(part, piece, template)
		if (!target) {
			return undefined
		}

		let result = this.collectRenameLocations(target, findInStrings, findInComments, preferences)
		return result.denied ? undefined : result.locations
	}

	private collectRenameLocations(
		target: RenameTarget,
		findInStrings: boolean,
		findInComments: boolean,
		preferences?: boolean | TS.UserPreferences
	) {
		let anchor = this.getIdentifier(target.anchor)
		let fileName = anchor.getSourceFile().fileName
		let position = anchor.getStart()
		let service = this.analyzer.context.service

		let rawLocations = service.findRenameLocations(
			fileName,
			position,
			findInStrings,
			findInComments,
			preferences as TS.UserPreferences
		) ?? []

		let locations = [...rawLocations]
		let anchorKeys = new Set(rawLocations.map(location => this.locationKey(location.fileName, location.textSpan)))

		for (let sourceFile of this.analyzer.context.program.getSourceFiles()) {
			for (let template of this.templateProvider.getAllTemplates(sourceFile.fileName)) {
				locations.push(...this.getTemplateLocations(template, target.kind, anchorKeys))
			}
		}

		locations = this.deduplicate(locations)

		let references = service.findReferences(fileName, position) ?? []

		let referencedFiles = references.flatMap(symbol => [
			symbol.definition.fileName,
			...symbol.references.map(reference => reference.fileName),
		])

		let denied = this.isNodeModules(fileName)
			|| referencedFiles.some(referenceFile => this.isNodeModules(referenceFile))
			|| locations.some(location => this.isNodeModules(location.fileName))

		return {denied, locations}
	}

	private getTemplateLocations(template: Template, kind: RenameTarget['kind'], anchorKeys: Set<string>): TS.RenameLocation[] {
		let locations: TS.RenameLocation[] = []

		for (let part of template.parts) {
			if (part.type !== kind) {
				continue
			}

			let candidate = this.resolveCandidateAnchor(part, template)
			if (!candidate) {
				continue
			}

			candidate = this.getIdentifier(candidate)
			let candidateSpan = {start: candidate.getStart(), length: candidate.getWidth()}
			if (!anchorKeys.has(this.locationKey(candidate.getSourceFile().fileName, candidateSpan))) {
				continue
			}

			let namePiece = parseAllTemplatePartPieces(part).find(piece => {
				return kind === TemplatePartType.Component
					? piece.type === TemplatePartPieceType.TagName
					: piece.type === TemplatePartPieceType.Name
			})
			if (!namePiece) {
				continue
			}

			let nameSpan = this.getPartNameSpan(part)
			locations.push(this.makeTemplateLocation(template, nameSpan.start, nameSpan.start + nameSpan.length))

			if (kind === TemplatePartType.Component) {
				let tagName = part.node.tagName!
				let closingEnd = part.node.closureEnd
				let closingStart = closingEnd - tagName.length
				if (closingEnd >= 0 && template.content.slice(closingStart, closingEnd) === tagName) {
					locations.push(this.makeTemplateLocation(template, closingStart, closingEnd))
				}
			}
		}

		return locations
	}

	/** Resolve part to get a rename target. */
	private resolveTarget(part: TemplatePart, piece: TemplatePartPiece, template: Template): RenameTarget | undefined {
		if (part.type === TemplatePartType.Component && piece.type === TemplatePartPieceType.TagName) {
			let item = this.analyzer.getComponentByTagName(part.node.tagName!, template)
			let anchor = template.getReferenceByName(part.node.tagName!)

			return item && anchor
				? {anchor, item, kind: TemplatePartType.Component}
				: undefined
		}

		if (part.type === TemplatePartType.Property && piece.type === TemplatePartPieceType.Name) {
			let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
			let item = component ? this.analyzer.getComponentProperty(component, part.mainName!) : undefined

			return item
				? {anchor: item.nameNode, item, kind: TemplatePartType.Property}
				: undefined
		}

		if (part.type === TemplatePartType.Binding && piece.type === TemplatePartPieceType.Name) {
			let item = this.analyzer.getBindingByName(part.mainName!, template)
			let anchor = template.getReferenceByName(part.mainName!) ?? item?.nameNode

			return item && anchor
				? {anchor, item, kind: TemplatePartType.Binding}
				: undefined
		}

		return undefined
	}

	/** Resolve definition node by template part. */
	private resolveCandidateAnchor(part: TemplatePart, template: Template): TS.Node | undefined {
		if (part.type === TemplatePartType.Component) {
			return template.getReferenceByName(part.node.tagName!)
		}

		if (part.type === TemplatePartType.Property) {
			let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
			return component ? this.analyzer.getComponentProperty(component, part.mainName!)?.nameNode : undefined
		}

		if (part.type === TemplatePartType.Binding) {
			let binding = this.analyzer.getBindingByName(part.mainName!, template)
			return template.getReferenceByName(part.mainName!) ?? binding?.nameNode
		}

		return undefined
	}

	private getIdentifier(node: TS.Node): TS.Node {
		return this.analyzer.context.helper.getIdentifier(node) ?? node
	}

	private getPartNameSpan(part: TemplatePart): TS.TextSpan {
		if (part.type === TemplatePartType.Component) {
			return {start: part.start, length: part.end - part.start}
		}

		let start = part.start + (part.namePrefix?.length ?? 0)
		return {start, length: part.mainName?.length ?? 0}
	}

	private makeTemplateLocation(template: Template, start: number, end: number): TS.RenameLocation {
		return {
			fileName: template.fileName,
			textSpan: {
				start: template.localOffsetToGlobal(start),
				length: template.localOffsetToGlobal(end) - template.localOffsetToGlobal(start),
			},
		}
	}

	private deduplicate(locations: readonly TS.RenameLocation[]): TS.RenameLocation[] {
		let seen = new Set<string>()
		return locations.filter(location => {
			let key = this.locationKey(location.fileName, location.textSpan)
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

	private isNodeModules(fileName: string): boolean {
		return /(^|\/)node_modules(\/|$)/i.test(fileName.replace(/\\/g, '/'))
	}
}
