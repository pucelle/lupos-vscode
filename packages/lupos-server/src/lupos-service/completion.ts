import type * as TS from 'typescript'
import {getScriptElementKind} from './utils'
import {TemplatePart, TemplatePartType, TemplateSlotPlaceholder, TemplatePartPiece, TemplatePartPieceType, LuposControlFlowTags, LuposBindingModifiers, LuposSimulatedEvents, LuposDOMEventModifiers, LuposDOMEventCategories, LuposComponentAttributes, getBindingModifierCompletionItems, findCompletionDataItem, filterCompletionDataItems} from '../lupos-ts-module'
import {ProjectContext, ts} from '../core'
import {WorkSpaceAnalyzer} from './analyzer'
import {DOMStyleProperties, DOMElementEvents, filterBooleanAttributeCompletionItems, filterDOMElementCompletionItems, CompletionItem, assignCompletionItems} from '../complete-data'
import {Template} from '../template-service'


/** Provide lupos completion service. */
export class LuposCompletion {

	readonly analyzer: WorkSpaceAnalyzer
	readonly context: ProjectContext

	constructor(analyzer: WorkSpaceAnalyzer) {
		this.analyzer = analyzer
		this.context = analyzer.context
	}

	getCompletions(part: TemplatePart, piece: TemplatePartPiece, template: Template): TS.CompletionInfo | undefined {

		// `<a`, `<`, `<A`, `<lu:`
		if (part.type === TemplatePartType.Component
			|| part.type === TemplatePartType.DynamicComponent
			|| part.type === TemplatePartType.FlowControl
			|| part.type === TemplatePartType.SlotTag
			|| part.type === TemplatePartType.NormalStartTag
		) {
			let components = this.analyzer.getComponentsForCompletion(part.node.tagName || '')
			let flowControlItems = filterCompletionDataItems(LuposControlFlowTags, part.node.tagName || '')

			return this.makeCompletionInfo([...components, ...flowControlItems], part, piece)
		}

		// `:binding`, `?:binding`
		// VSCode has a bug here: input unique `:` cause no completion action.
		else if (part.type === TemplatePartType.Binding) {
			let items = this.getBindingCompletionItems(part, piece, template)
			return this.makeCompletionInfo(items, part, piece)
		}

		// `?xxx`
		else if (part.type === TemplatePartType.QueryAttribute) {
			let items = this.getQueryAttributeCompletionItems(part, piece)
			return this.makeCompletionInfo(items, part, piece)
		}

		// `.xxx`
		else if (part.type === TemplatePartType.Property) {
			let items = this.getPropertyCompletionInfo(part, piece, template)
			return this.makeCompletionInfo(items, part, piece)
		}

		// `@xxx` or `@@xxx`
		else if (part.type === TemplatePartType.Event) {
			let items = this.getEventCompletionItems(part, piece, template)
			return this.makeCompletionInfo(items, part, piece)
		}

		// `tagName="xxx"`
		else if ((part.type === TemplatePartType.UnSlottedAttribute || part.type === TemplatePartType.SlottedAttribute)
			&& TemplateSlotPlaceholder.isComponent(part.node.tagName!)
		) {
			if (piece.type === TemplatePartPieceType.Name) {
				let items = filterCompletionDataItems(LuposComponentAttributes, part.mainName!)
				return this.makeCompletionInfo(items, part, piece)
			}
			else if (piece.type === TemplatePartPieceType.AttrValue && part.mainName === 'tagName') {
				let items = filterDOMElementCompletionItems(part.attr!.value!)
				return this.makeCompletionInfo(items, part, piece)
			}
		}

		return undefined
	}

	private getBindingCompletionItems(part: TemplatePart, piece: TemplatePartPiece, template: Template) {
		let mainName = part.mainName!
		let items: CompletionItem[] = []

		// `:name|`, complete binding name.
		if (piece.type === TemplatePartPieceType.Name) {
			let bindingItems = this.analyzer.getBindingsForCompletion(mainName)

			// `:|` - complete from here
			items.push(...bindingItems)
		}

		// `:ref.|`, complete modifiers.
		else if (piece.type === TemplatePartPieceType.Modifier) {
			items.push(...this.getBindingModifierCompletionItems(part, piece, template))
		}

		// `:slot="|"`.
		else if (piece.type === TemplatePartPieceType.AttrValue) {
			items.push(...this.getBindingAttrValueCompletionItems(part, template))
		}

		// Completion of `:class` will be handled by `CSS Navigation` plugin.

		return items
	}

	private getBindingModifierCompletionItems(part: TemplatePart, piece: TemplatePartPiece, template: Template) {
		let modifiers = part.modifiers!
		let mainName = part.mainName!
		let items: CompletionItem[] = []
		let modifierIndex = piece.modifierIndex!
		let modifierValue = modifiers[modifierIndex]

		// `:style`
		if (mainName === 'style') {

			// Complete style property.
			if (modifierIndex === 0) {
				let filtered = filterCompletionDataItems(DOMStyleProperties, modifierValue)
				items.push(...filtered)
			}

			// Complete style unit.
			else if (modifierIndex === 1) {
				let filtered = filterCompletionDataItems(LuposBindingModifiers.style, modifierValue)
				items.push(...filtered)
			}
		}

		// Not `:style`
		else {
				
			// Local declared.
			let binding = this.analyzer.getBindingByName(mainName, template)

			// All available parameters from binding constructor.
			let availableModifiers: string[] | null = null

			// Try parse bind class modifiers parameter.
			if (binding) {
				let bindingClassParams = this.context.helper.class.getConstructorParameters(binding.declaration)
				let modifiersParamType = bindingClassParams && bindingClassParams.length === 3 ? bindingClassParams[2].type : null

				availableModifiers = modifiersParamType ?
					this.context.helper.types.splitUnionTypeToStringList(this.context.helper.types.typeOfTypeNode(modifiersParamType)!)
					: null
			}

			// Use known binding modifiers.
			if (!availableModifiers) {
				availableModifiers = LuposBindingModifiers[mainName]?.map(item => item.name)
			}

			// Make normal modifier items.
			let modifierItems = getBindingModifierCompletionItems(mainName, modifiers, availableModifiers)
			let filtered = filterCompletionDataItems(modifierItems, modifierValue)
			items.push(...filtered)
		}

		// Completion of `:class` will be handled by `CSS Navigation` plugin.

		return items
	}

	// `:slot="|"`.
	private getBindingAttrValueCompletionItems(part: TemplatePart, template: Template) {
		let attr = part.attr!
		let mainName = part.mainName!
		let attrValue = attr.value!
		let items: CompletionItem[] = []

		// :slot="|name"
		if (['slot'].includes(mainName) && template.component) {
			let currentComponent = this.analyzer.getComponentByDeclaration(template.component)!
			let propertyItems = this.analyzer.getSubPropertiesForCompletion(currentComponent, 'slotElements', attrValue)

			items.push(...propertyItems)
		}

		return items
	}

	private getQueryAttributeCompletionItems(part: TemplatePart, piece: TemplatePartPiece) {
		let items: CompletionItem[] = []

		if (piece.type === TemplatePartPieceType.Name) {
			let properties = filterBooleanAttributeCompletionItems(part.mainName!, part.node.tagName!)
			items.push(...properties)
		}

		return items
	}

	private getPropertyCompletionInfo(part: TemplatePart, piece: TemplatePartPiece, template: Template) {
		let attr = part.attr!
		let mainName = part.mainName!
		let items: CompletionItem[] = []
		
		// `.|property|`, complete property name.
		if (piece.type === TemplatePartPieceType.Name) {
			let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
			let properties = component ? this.analyzer.getComponentPropertiesForCompletion(component, mainName) : []
			items.push(...properties)
		}

		// `.property="|"`, complete property value.
		else if (piece.type === TemplatePartPieceType.AttrValue) {
			let attrValue = attr.value!

			// For `<Icon .type="|">`
			if (part.node.tagName!.includes('Icon') && mainName === 'type') {
				let iconItems = this.analyzer.getIconsForCompletion(attrValue)
				items.push(...iconItems)
			}

			// For `.prop="a" | "b" | "c"`
			else {
				let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
				let property = component ? this.analyzer.getComponentProperty(component, mainName) : null
				if (property) {
					let typeStringList = this.context.helper.types.splitUnionTypeToStringList(property.type)

					let typeItems = typeStringList.map(name => {
						return {
							name,
							description: '',
						}
					})

					items.push(...typeItems)
				}
			}
		}

		return items
	}
	
	private getEventCompletionItems(part: TemplatePart, piece: TemplatePartPiece, template: Template) {
		let modifiers = part.modifiers!
		let mainName = part.mainName!
		let tagName = part.node.tagName!
		let items: CompletionItem[] = []
		let isComponent = TemplateSlotPlaceholder.isComponent(tagName)
		let component = isComponent ? this.analyzer.getComponentByTagName(tagName, template) : null
		let domEvents = part.namePrefix === '@' ? filterCompletionDataItems(DOMElementEvents, mainName) : []
		let fullyMatchedDomEvent = findCompletionDataItem(domEvents, mainName)
		let domItems = assignCompletionItems(domEvents, {kind: ts.ScriptElementKind.enumElement})

		// `@cli|`, complete event name.
		if (piece.type === TemplatePartPieceType.Name) {
			let comEvents = component ? this.analyzer.getComponentEventsForCompletion(component!, mainName) : []
			let comItems = assignCompletionItems(comEvents, {order: -1})

			let simEvents = part.namePrefix === '@' ? filterCompletionDataItems(LuposSimulatedEvents, mainName) : []
			let simItems = assignCompletionItems(simEvents, {order: 1, kind: ts.ScriptElementKind.enumMemberElement})

			let eventItems = [...comItems, ...domItems, ...simItems]

			items.push(...eventItems)
		}

		// `@click.`, complete modifiers.
		else if (piece.type === TemplatePartPieceType.Modifier && fullyMatchedDomEvent) {
			let modifierIndex = piece.modifierIndex!
			let modifierValue = modifiers[modifierIndex]

			// `.passive`, `.stop`, ...
			let globalItems = filterCompletionDataItems(LuposDOMEventModifiers.global, modifierValue)
			globalItems = globalItems.filter(item => !modifiers.includes(item.name))
			items.push(...globalItems)

			// `@keydown.enter`, `@click.left`.
			// Not provide control keys completion.
			if (LuposDOMEventCategories[mainName]) {
				let category = LuposDOMEventCategories[mainName]
				let categoryItems = filterCompletionDataItems(LuposDOMEventModifiers[category], modifierValue)
				items.push(...categoryItems)
			}
		}

		return items
	}

	private makeCompletionInfo(
		items: CompletionItem[] | undefined,
		part: TemplatePart,
		piece: TemplatePartPiece
	): TS.CompletionInfo | undefined {
		if (!items) {
			return undefined
		}

		let names: Set<string> = new Set()

		let entries: TS.CompletionEntry[] = items.map(item => {
			let kind = getScriptElementKind(item, part, piece)
			let start = item.start ?? piece.start
			let end = item.end ?? piece.end

			let replacementSpan: TS.TextSpan = {
				start,
				length: end - start,
			}

			return {
				name: item.name,
				kind,
				sortText: String(item.order ?? 0),
				insertText: item.name,
				replacementSpan,
			}
		})

		// Filter out repetitive items.
		entries = entries.filter(item => {
			if (names.has(item.name)) {
				return false
			}

			names.add(item.name)
			return true
		})

		return {
			isGlobalCompletion: false,
			isMemberCompletion: false,
			isNewIdentifierLocation: false,
			entries: entries,
		}
	}
}
