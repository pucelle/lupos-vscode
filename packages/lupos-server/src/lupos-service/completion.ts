import type * as TS from 'typescript'
import {getScriptElementKind} from './utils'
import {TemplatePart, TemplatePartType, TemplateSlotPlaceholder, TemplatePartLocation, TemplatePartLocationType} from '../lupos-ts-module'
import {Logger, ProjectContext} from '../core'
import {LuposAnalyzer} from './analyzer'
import {LuposSimulatedEvents, filterCompletionItems, LuposControlFlowTags, LuposDOMEventModifiers, LuposDOMEventCategories, DOMStyleProperties, DOMElementEvents, LuposBindingModifiers, filterBooleanAttributeCompletionItems, getBindingModifierCompletionItems, findFullyMatchedCompletionItem, LuposComponentAttributes, filterDOMElementCompletionItems, mapCompletionItems} from '../complete-data'
import {Template} from '../template-service'


/** Provide lupos completion service. */
export class LuposCompletion {

	readonly analyzer: LuposAnalyzer
	readonly context: ProjectContext

	constructor(analyzer: LuposAnalyzer) {
		this.analyzer = analyzer
		this.context = analyzer.context
	}

	getCompletions(part: TemplatePart, location: TemplatePartLocation, template: Template): TS.CompletionInfo | undefined {
		let p = {...part} as any
		p.node = null
		Logger.log(p)
		Logger.log(location)

		// `<a|`, `<|`, `<A|`, `<lu:|`
		if (part.type === TemplatePartType.Component
			|| part.type === TemplatePartType.DynamicComponent
			|| part.type === TemplatePartType.FlowControl
			|| part.type === TemplatePartType.SlotTag
			|| part.type === TemplatePartType.NormalStartTag
		) {
			let components = this.analyzer.getComponentsForCompletion(part.node.tagName || '')
			let flowControlItems = filterCompletionItems(LuposControlFlowTags, part.node.tagName || '')

			return this.makeCompletionInfo([...components, ...flowControlItems], part, location)
		}

		// `:binding`, `?:binding`
		// VSCode has a bug here: input unique `:` cause no completion action.
		else if (part.type === TemplatePartType.Binding) {
			let items = this.getBindingCompletionItems(part, location, template)
			return this.makeCompletionInfo(items, part, location)
		}

		// `?xxx`
		else if (part.type === TemplatePartType.QueryAttribute) {
			let items = this.getQueryAttributeCompletionItems(part, location)
			return this.makeCompletionInfo(items, part, location)
		}

		// `.xxx`
		else if (part.type === TemplatePartType.Property) {
			let items = this.getPropertyCompletionInfo(part, location, template)
			return this.makeCompletionInfo(items, part, location)
		}

		// `@xxx` or `@@xxx`
		else if (part.type === TemplatePartType.Event) {
			let items = this.getEventCompletionItems(part, location, template)
			return this.makeCompletionInfo(items, part, location)
		}

		// `tagName="xxx"`
		else if ((part.type === TemplatePartType.UnSlottedAttribute || part.type === TemplatePartType.SlottedAttribute)
			&& TemplateSlotPlaceholder.isComponent(part.node.tagName!)
		) {
			if (location.type === TemplatePartLocationType.Name) {
				let items = filterCompletionItems(LuposComponentAttributes, part.mainName!)
				return this.makeCompletionInfo(items, part, location)
			}
			else if (location.type === TemplatePartLocationType.AttrValue && part.mainName === 'tagName') {
				let items = filterDOMElementCompletionItems(part.attr!.value!)
				return this.makeCompletionInfo(items, part, location)
			}
		}

		return undefined
	}

	private getBindingCompletionItems(part: TemplatePart, location: TemplatePartLocation, template: Template) {
		let mainName = part.mainName!
		let items: CompletionItem[] = []

		// `:name|`, complete binding name.
		if (location.type === TemplatePartLocationType.Name) {
			let bindingItems = this.analyzer.getBindingsForCompletion(mainName)

			// `:|` - complete from here
			items.push(...bindingItems)
		}

		// `:ref.|`, complete modifiers.
		else if (location.type === TemplatePartLocationType.Modifier) {
			items.push(...this.getBindingModifierCompletionItems(part, location, template))
		}

		// `:slot="|"`.
		else if (location.type === TemplatePartLocationType.AttrValue) {
			items.push(...this.getBindingAttrValueCompletionItems(part, template))
		}

		// Completion of `:class` will be handled by `CSS Navigation` plugin.

		return items
	}

	private getBindingModifierCompletionItems(part: TemplatePart, location: TemplatePartLocation, template: Template) {
		let modifiers = part.modifiers!
		let mainName = part.mainName!
		let items: CompletionItem[] = []
		let modifierIndex = location.modifierIndex!
		let modifierValue = modifiers[modifierIndex]

		// `:style`
		if (mainName === 'style') {

			// Complete style property.
			if (modifierIndex === 0) {
				let filtered = filterCompletionItems(DOMStyleProperties, modifierValue)
				items.push(...filtered)
			}

			// Complete style unit.
			else if (modifierIndex === 1) {
				let filtered = filterCompletionItems(LuposBindingModifiers.style, modifierValue)
				items.push(...filtered)
			}
		}

		// Not `:style`
		else {
				
			// Local declared.
			let binding = this.analyzer.getBindingByNameAndTemplate(mainName, template)

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
			let filtered = filterCompletionItems(modifierItems, modifierValue)
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
		if (['slot'].includes(mainName)) {
			let currentComponent = this.analyzer.getComponentByDeclaration(template.component)!
			let propertyItems = this.analyzer.getSubPropertiesForCompletion(currentComponent, 'slotElements', attrValue)

			items.push(...propertyItems)
		}

		return items
	}

	private getQueryAttributeCompletionItems(part: TemplatePart, location: TemplatePartLocation) {
		let items: CompletionItem[] = []

		if (location.type === TemplatePartLocationType.Name) {
			let properties = filterBooleanAttributeCompletionItems(part.mainName!, part.node.tagName!)
			items.push(...properties)
		}

		return items
	}

	private getPropertyCompletionInfo(part: TemplatePart, location: TemplatePartLocation, template: Template) {
		let attr = part.attr!
		let mainName = part.mainName!
		let items: CompletionItem[] = []

		
		// `.|property|`, complete property name.
		if (location.type === TemplatePartLocationType.Name) {
			let components = this.analyzer.getComponentsByTagName(part.node.tagName!, template)

			for (let component of components) {
				let properties = this.analyzer.getComponentPropertiesForCompletion(component, mainName)
				items.push(...properties)
			}
		}

		// `.property="|"`, complete property value.
		else if (location.type === TemplatePartLocationType.AttrValue) {
			let attrValue = attr.value!

			// For `<Icon .type="|">`
			if (part.node.tagName!.includes('Icon') && mainName === 'type') {
				let iconItems = this.analyzer.getIconsForCompletion(attrValue)
				items.push(...iconItems)
			}

			// For `.prop="a" | "b" | "c"`
			else {
				let components = this.analyzer.getComponentsByTagName(part.node.tagName!, template)

				for (let component of components) {
					let property = this.analyzer.getComponentProperty(component, mainName)
					if (!property) {
						continue
					}

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
	
	private getEventCompletionItems(part: TemplatePart, location: TemplatePartLocation, template: Template) {
		let modifiers = part.modifiers!
		let mainName = part.mainName!
		let tagName = part.node.tagName!
		let items: CompletionItem[] = []
		let isComponent = TemplateSlotPlaceholder.isComponent(tagName)
		let components = isComponent ? [...this.analyzer.getComponentsByTagName(tagName, template)] : []
		let domEvents = part.namePrefix === '@' ? filterCompletionItems(DOMElementEvents, mainName) : []
		let fullyMatchedDomEvent = findFullyMatchedCompletionItem(domEvents, mainName)

		// `@cli|`, complete event name.
		if (location.type === TemplatePartLocationType.Name) {
			let comEvents = components.map(com => this.analyzer.getComponentEventsForCompletion(com, mainName)).flat()

			// Shows component events before others.
			let comItems = mapCompletionItems(comEvents, item => ({...item, order: -1}))

			let simItems = part.namePrefix === '@' ? filterCompletionItems(LuposSimulatedEvents, mainName) : []
			let eventItems = [...comItems, ...domEvents, ...simItems]

			items.push(...eventItems)
		}

		// `@click.`, complete modifiers.
		else if (location.type === TemplatePartLocationType.Modifier && fullyMatchedDomEvent) {
			let modifierIndex = location.modifierIndex!
			let modifierValue = modifiers[modifierIndex]

			// `.passive`, `.stop`, ...
			let globalItems = filterCompletionItems(LuposDOMEventModifiers.global, modifierValue)
			globalItems = globalItems.filter(item => !modifiers.includes(item.name))
			items.push(...globalItems)

			// `@keydown.enter`, `@click.left`.
			// Not provide control keys completion.
			if (LuposDOMEventCategories[mainName]) {
				let category = LuposDOMEventCategories[mainName]
				let categoryItems = filterCompletionItems(LuposDOMEventModifiers[category], modifierValue)
				items.push(...categoryItems)
			}
		}

		return items
	}

	private makeCompletionInfo(
		items: CompletionItem[] | undefined,
		part: TemplatePart,
		location: TemplatePartLocation
	): TS.CompletionInfo | undefined {
		if (!items) {
			return undefined
		}

		let names: Set<string> = new Set()

		let entries: TS.CompletionEntry[] = items.map(item => {
			let kind = getScriptElementKind(item, part, location)
			let start = item.start ?? location.start
			let end = item.end ?? location.end

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
