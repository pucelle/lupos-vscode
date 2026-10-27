import type TS from 'typescript'
import {TemplatePart, TemplatePartType, TemplateSlotPlaceholder, TemplatePartPiece, TemplatePartPieceType, LUPOS_FLOW_CONTROL_TAGS, LUPOS_BINDING_MODIFIERS, LUPOS_SIMULATED_EVENTS, LUPOS_DOM_EVENT_MODIFIERS, LUPOS_DOM_EVENT_CATEGORIES, LUPOS_COMPONENT_ATTRIBUTES, getBindingModifierCompletionItems, findCompletionDataItem, filterCompletionDataItems} from '../lupos-ts-module'
import {ProjectContext, ts} from '../core'
import {WorkSpaceAnalyzer} from './analyzer'
import {DOMStyleProperties, DOMElementEvents, filterBooleanAttributeCompletionItems, filterDOMElementCompletionItems, CompletionItem, assignCompletionItems} from '../complete-data'
import {Template} from '../template-service'
import {makeCompletionEntryDetails, makeCompletionInfo} from './helpers/completion-converter'


/** Required control-tag expressions and their snippet tab stops. */
const CONTROL_TAG_PARAMETERS: Readonly<Record<string, string>> = {
	'lu:await': ' \\${${1}}',
	'lu:for': ' \\${${1:item, index}} of \\${${2:list}}',
	'lu:if': ' \\${${1}}',
	'lu:elseif': ' \\${${1}}',
	'lu:keyed': ' \\${${1}}',
	'lu:switch': ' \\${${1}}',
	'lu:case': ' \\${${1}}',
}


/** Provide lupos completion service. */
export class LuposCompletion {

	readonly analyzer: WorkSpaceAnalyzer
	readonly context: ProjectContext

	constructor(analyzer: WorkSpaceAnalyzer) {
		this.analyzer = analyzer
		this.context = analyzer.context
	}

	getCompletionInfo(part: TemplatePart, piece: TemplatePartPiece, template: Template): TS.CompletionInfo {
		let items = this.getCompletionItems(part, piece, template)

		if (piece.type === TemplatePartPieceType.TagName) {
			for (let i = 0; i < items.length; i++) {
				let item = items[i]

				let ref = template.getReferenceByName(item.name)
				if (ref) {
					continue
				}

				// Resolve for import path for each completion item.
				let importPath = this.analyzer.resolveBestPartImportPath(part, template, item.name)
				if (importPath) {
					items[i] = {
						...item,
						infoDescription: importPath,
					}
				}
			}
		}

		let info = makeCompletionInfo(items, part, piece)

		if (piece.type === TemplatePartPieceType.TagName) {
			this.addControlTagSnippets(info, part, piece, template)
		}

		return info
	}

	/** Expand new control tags into editable parameters and an indented body. */
	private addControlTagSnippets(
		info: TS.CompletionInfo,
		part: TemplatePart,
		piece: TemplatePartPiece,
		template: Template
	) {
		let node = part.node

		if (node.closureEnd >= 0 || node.children.length > 0 || node.attrs?.length) {
			return
		}

		let lineBreak = template.sourceFile.text.match(/\r?\n/)?.[0] ?? '\n'
		let existingEnd = template.content.slice(piece.end).match(/^[ \t]*>/)?.[0] ?? ''

		for (let entry of info.entries) {
			if (!LUPOS_FLOW_CONTROL_TAGS.some(tag => tag.name === entry.name)) {
				continue
			}

			let parameters = CONTROL_TAG_PARAMETERS[entry.name] ?? ''
			let closingEnd = existingEnd ? '' : '>'

			entry.insertText = entry.name + parameters + '>'
				+ lineBreak + '\t$0' + lineBreak + '</' + entry.name + closingEnd

			entry.isSnippet = true

			if (entry.replacementSpan) {

				// Keep the existing '>' for the snippet's closing tag in either completion mode.
				entry.replacementSpan.length += Math.max(0, existingEnd.length - 1)
			}
		}
	}

	getCompletionEntryDetails(part: TemplatePart, piece: TemplatePartPiece, template: Template, name: string): TS.CompletionEntryDetails | undefined {
		let items = this.getCompletionItems(part, piece, template)
		let item = items.find(item => item.name === name)
		if (!item) {
			return undefined
		}

		// When have local reference.
		let ref = template.getReferenceByName(item.name)
		if (ref) {
			return undefined
		}

		let pathChange = this.analyzer.resolveBestImportPathAndTextChange(part, template, item.name)
		return makeCompletionEntryDetails(item, part, piece, pathChange)
	}

	protected getCompletionItems(part: TemplatePart, piece: TemplatePartPiece, template: Template): CompletionItem[] {
		let items: CompletionItem[] = []

		// Print part
		// let p = {...part} as any
		// p.node = null
		// Logger.log(p)

		// `<a`, `<`, `<A`, `<lu:`.
		if (part.type === TemplatePartType.Component
			|| part.type === TemplatePartType.FlowControl
			|| part.type === TemplatePartType.EmptyStartTag
		) {
			if (part.type === TemplatePartType.Component
				|| part.type === TemplatePartType.EmptyStartTag
			) {
				let components = this.analyzer.getComponentsForCompletion(part.node.tagName || '')
				items.push(...components)
			}

			if (part.type === TemplatePartType.FlowControl
				|| part.type === TemplatePartType.EmptyStartTag
			) {
				let flowControlItems = filterCompletionDataItems(LUPOS_FLOW_CONTROL_TAGS, part.node.tagName || '')
				items.push(...flowControlItems)
			}
		}

		// `:binding`, `?:binding`
		// VSCode has a bug here: input unique `:` cause no completion action.
		else if (part.type === TemplatePartType.Binding) {
			items = this.getBindingCompletionItems(part, piece, template)
		}

		// `?xxx`
		else if (part.type === TemplatePartType.QueryAttribute) {
			items = this.getQueryAttributeCompletionItems(part, piece)
		}

		// `.xxx`
		else if (part.type === TemplatePartType.Property) {
			items = this.getPropertyCompletionItems(part, piece, template)
		}

		// `@xxx` or `@@xxx`
		else if (part.type === TemplatePartType.Event) {
			items = this.getEventCompletionItems(part, piece, template)
		}

		// `tagName="xxx"`
		else if ((part.type === TemplatePartType.UnSlottedAttribute || part.type === TemplatePartType.SlottedAttribute)
			&& TemplateSlotPlaceholder.isComponent(part.node.tagName!)
		) {
			if (piece.type === TemplatePartPieceType.Name) {
				items = filterCompletionDataItems(LUPOS_COMPONENT_ATTRIBUTES, part.mainName!)
			}
			else if (piece.type === TemplatePartPieceType.AttrValue && part.mainName === 'tagName') {
				items = filterDOMElementCompletionItems(part.attr!.value!)
			}
		}

		return items
	}

	private getBindingCompletionItems(part: TemplatePart, piece: TemplatePartPiece, template: Template): CompletionItem[] {
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

		// Completion of `:class` will be handled by `CSS Navigation` plugin.

		return items
	}

	private getBindingModifierCompletionItems(part: TemplatePart, piece: TemplatePartPiece, template: Template): CompletionItem[] {
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
				let filtered = filterCompletionDataItems(LUPOS_BINDING_MODIFIERS.style, modifierValue)
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
				let bindingClassParams = this.context.helper.class.getConstructorParameters(binding.declaration, true)
				let modifiersParamType = bindingClassParams && bindingClassParams.length === 3 ? bindingClassParams[2].type : null

				availableModifiers = modifiersParamType ?
					this.context.helper.types.splitUnionTypeToStringList(this.context.helper.types.typeOfTypeNode(modifiersParamType)!)
					: null
			}

			// Use known binding modifiers.
			if (!availableModifiers || availableModifiers.length === 0) {
				availableModifiers = LUPOS_BINDING_MODIFIERS[mainName]?.map(item => item.name)
			}

			// Make normal modifier items.
			let modifierItems = getBindingModifierCompletionItems(mainName, modifiers, availableModifiers)
			let filtered = filterCompletionDataItems(modifierItems, modifierValue)
			items.push(...filtered)
		}

		// Completion of `:class` will be handled by `CSS Navigation` plugin.

		return items
	}

	private getQueryAttributeCompletionItems(part: TemplatePart, piece: TemplatePartPiece): CompletionItem[] {
		let items: CompletionItem[] = []

		if (piece.type === TemplatePartPieceType.Name) {
			let properties = filterBooleanAttributeCompletionItems(part.mainName!, part.node.tagName!)
			items.push(...properties)
		}

		return items
	}

	private getPropertyCompletionItems(part: TemplatePart, piece: TemplatePartPiece, template: Template): CompletionItem[] {
		let mainName = part.mainName!
		let items: CompletionItem[] = []
		let helper = template.helper
		
		// `.|property|`, complete property name.
		if (piece.type === TemplatePartPieceType.Name) {
			let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
			let properties = component ? this.analyzer.getComponentPropertiesForCompletion(component, mainName) : []
			items.push(...properties)
		}

		// `.property="|"`, complete property value.
		else if (piece.type === TemplatePartPieceType.AttrValue) {
	
			// For `.prop="a" | "b" | "c"`
			let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
			let property = component ? this.analyzer.getComponentProperty(component, mainName) : null
			if (property) {
				let propertyType = helper.types.typeOf(property.nameNode)
				let typeStringList = this.context.helper.types.splitUnionTypeToStringList(propertyType)

				let typeItems = typeStringList.map(name => {
					return {
						name,
						description: '',
					}
				})

				items.push(...typeItems)
			}
		}

		return items
	}
	
	private getEventCompletionItems(part: TemplatePart, piece: TemplatePartPiece, template: Template): CompletionItem[] {
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

			let simEvents = part.namePrefix === '@' ? filterCompletionDataItems(LUPOS_SIMULATED_EVENTS, mainName) : []
			let simItems = assignCompletionItems(simEvents, {order: 1, kind: ts.ScriptElementKind.enumMemberElement})

			let eventItems = [...comItems, ...domItems, ...simItems]

			items.push(...eventItems)
		}

		// `@click.`, complete modifiers.
		else if (piece.type === TemplatePartPieceType.Modifier && fullyMatchedDomEvent) {
			let modifierIndex = piece.modifierIndex!
			let modifierValue = modifiers[modifierIndex]

			// `.passive`, `.stop`, ...
			let globalItems = filterCompletionDataItems(LUPOS_DOM_EVENT_MODIFIERS.global, modifierValue)
			globalItems = globalItems.filter(item => !modifiers.includes(item.name))
			items.push(...globalItems)

			// `@keydown.enter`, `@click.left`.
			// Not provide control keys completion.
			if (LUPOS_DOM_EVENT_CATEGORIES[mainName]) {
				let category = LUPOS_DOM_EVENT_CATEGORIES[mainName]
				let categoryItems = filterCompletionDataItems(LUPOS_DOM_EVENT_MODIFIERS[category], modifierValue)
				items.push(...categoryItems)
			}
		}

		return items
	}
}
