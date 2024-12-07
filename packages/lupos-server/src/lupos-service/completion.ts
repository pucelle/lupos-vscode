import type * as TS from 'typescript'
import {getScriptElementKindFromToken} from './utils'
import {TemplatePart, TemplatePartType, TemplateSlotPlaceholder, TemplatePartLocation, TemplatePartLocationType} from '../lupos-ts-module'
import {ProjectContext} from '../core'
import {LuposAnalyzer} from './analyzer'
import {LuposSimulatedEvents, filterCompletionItems, LuposControlFlowTags, LuposDomEventModifiers, LuposEventCategories, DOMStyleProperties, DOMElementEvents, LuposBindingModifiers, assignCompletionItems, filterBooleanAttributeCompletionItems, getBindingModifierCompletionItems} from '../complete-data'
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
		
		// `<a|`, `<|`, `<A|`, `<lu:|`
		if (part.type === TemplatePartType.Component
			|| part.type === TemplatePartType.DynamicComponent
			|| part.type === TemplatePartType.FlowControl
			|| part.type === TemplatePartType.SlotTag
			|| part.type === TemplatePartType.NormalStartTag
		) {
			let components = this.analyzer.getComponentsForCompletion(part.mainName!)
			let flowControlItems = filterCompletionItems(LuposControlFlowTags, part.mainName!)

			return this.makeCompletionInfo([...components, ...flowControlItems], part, location)
		}

		// `:binding`, `?:binding`
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
		else if (part.type === TemplatePartType.UnSlottedAttribute
			&& TemplateSlotPlaceholder.isComponent(part.node.tagName!)
			&& location.type === TemplatePartLocationType.Name
		) {
			// let info = Lupos.find(item => item.name === part.rawName)
			// if (info) {
			// 	return this.makeQuickInfo(info, part, location)
			// }
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
			items.push(...assignCompletionItems(bindingItems, location))

			// `:class|=`, complete with `=`.
			let fullyMatched = bindingItems.find(item => item.name === mainName)
			if (fullyMatched) {
				items.push({name: '=', description: '', start: part.end})
			}
		}

		// `:ref.|`, complete modifiers.
		else if (location.type === TemplatePartLocationType.Modifier) {
			items.push(...this.getBindingModifierCompletionItems(part, location, template))
		}

		// `:slot="|"`.
		else if (location.type === TemplatePartLocationType.AttrValue) {
			items.push(...this.getBindingAttrValueCompletionItems(part, location, template))
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
				items.push(...assignCompletionItems(filtered, location))
			}

			// Complete style unit.
			else if (modifierIndex === 1) {
				let filtered = filterCompletionItems(LuposBindingModifiers.style, modifierValue)
				items.push(...assignCompletionItems(filtered, location))
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
			items.push(...assignCompletionItems(filtered, location))
		}

		// Completion of `:class` will be handled by `CSS Navigation` plugin.

		return items
	}

	// `:slot="|"`.
	private getBindingAttrValueCompletionItems(part: TemplatePart, location: TemplatePartLocation, template: Template) {
		let attr = part.attr!
		let mainName = part.mainName!
		let attrValue = attr.value!
		let items: CompletionItem[] = []

		// :slot="|name"
		if (['slot'].includes(mainName)) {
			let currentComponent = this.analyzer.getComponentByDeclaration(template.component)!
			let propertyItems = this.analyzer.getSubPropertiesForCompletion(currentComponent, 'slotElements', attrValue)

			items.push(...assignCompletionItems(propertyItems, location))
		}

		return items
	}

	private getQueryAttributeCompletionItems(part: TemplatePart, location: TemplatePartLocation) {
		let items: CompletionItem[] = []

		if (location.type === TemplatePartLocationType.Name) {
			let properties = filterBooleanAttributeCompletionItems(part.mainName!, part.node.tagName!)

			items.push(...assignCompletionItems(properties, {start: part.start + 1}))

			// `?|:`
			items.push({
				name: ':',
				description: '',
				start: part.end,
			})
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
				items.push(...assignCompletionItems(properties, location))
			}
		}

		// `.property="|"`, complete property value.
		else if (location.type === TemplatePartLocationType.AttrValue) {
			let attrValue = attr.value!

			// For `<Icon .type="|">`
			if (part.node.tagName!.includes('Icon') && mainName === 'type') {
				let iconItems = this.analyzer.getIconsForCompletion(attrValue)
				items.push(...assignCompletionItems(iconItems, location))
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

					items.push(...assignCompletionItems(typeItems, location))
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
		let domEvents = filterCompletionItems(DOMElementEvents, mainName)

		// `@cli|`, complete event name.
		if (location.type === TemplatePartLocationType.Name) {
			let comEvents = components.map(com => this.analyzer.getComponentEventsForCompletion(com, mainName)).flat()
			let simEvents = filterCompletionItems(LuposSimulatedEvents, mainName)
			let eventItems = [...comEvents, ...domEvents, ...simEvents]
		
			items.push(...assignCompletionItems(eventItems, location))

			// `:class|=`, complete with `=`.
			let fullyMatched = eventItems.find(item => item.name === mainName)
			if (fullyMatched) {
				items.push({name: '=', description: '', start: part.end})
			}
		}

		// `@click.`, complete modifiers.
		else if (location.type === TemplatePartLocationType.Modifier) {
			let modifierIndex = location.modifierIndex!
			let modifierValue = modifiers[modifierIndex]
			let previousModifierValue = modifierIndex > 0 ? modifiers[modifierIndex - 1] : null

			// Only `@click.Ctrl+|`, not for `@click.Ctrl+K|`.
			if (previousModifierValue && LuposDomEventModifiers.controlKey.find(item => item.name === previousModifierValue)) {
				let keyItems = filterCompletionItems(LuposDomEventModifiers.keyCode, '')
				items.push(...assignCompletionItems(keyItems, location))
			}

			else {
				// `.passive`, `.stop`, ...
				let globalItems = filterCompletionItems(LuposDomEventModifiers.global, modifierValue)
				globalItems = globalItems.filter(item => !modifiers.includes(item.name))
				items.push(...assignCompletionItems(globalItems, location))

				// `@keydown.Enter`, `@click.left`.
				if (LuposEventCategories[mainName]) {
					let category = LuposEventCategories[mainName]
					let categoryItems = filterCompletionItems(LuposDomEventModifiers[category], mainName)
					items.push(...assignCompletionItems(categoryItems, location))
				}
			}
		}

		return items
	}

	private makeCompletionInfo(items: CompletionItem[] | undefined, part: TemplatePart, location: TemplatePartLocation): TS.CompletionInfo | undefined {
		if (!items) {
			return undefined
		}

		let names: Set<string> = new Set()

		let entries: TS.CompletionEntry[] = items.map(item => {
			let kind = getScriptElementKindFromToken(part, location)
			let start = item.start ?? part.start
			let end = item.end ?? part.end

			let replacementSpan: TS.TextSpan = {
				start,
				length: end - start,
			}

			return {
				name: item.name,
				kind,
				sortText: item.name,
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
