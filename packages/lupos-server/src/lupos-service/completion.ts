import type * as TS from 'typescript'
import {DOMElementEvents} from '../complete-data/dom-element-events'
import {LuposBindingModifiers} from '../complete-data/lupos-binding-modifiers'
import {DOMStyleProperties} from '../complete-data/dom-style-properties'
import {getScriptElementKindFromToken, splitPropertyAndModifiers} from './utils'
import {LuposDomEventModifiers, LuposEventCategories} from '../complete-data/lupos-dom-event-modifiers'
import {DOMBooleanAttributes} from '../complete-data/dom-boolean-attributes'
import {findNodeAscent} from '../ts-utils/_ast-utils'
import {getSimulateTokenFromNonTemplate} from './non-template'
import {TemplateSlot, TemplateSlotType} from '../lupos-ts-module'
import {ProjectContext} from '../core'
import {LuposAnalyzer} from './analyzer'


/** Provide flit completion service. */
export class LuposCompletion {

	readonly analyzer: LuposAnalyzer
	readonly context: ProjectContext

	constructor(analyzer: LuposAnalyzer) {
		this.analyzer = analyzer
		this.context = analyzer.context
	}

	/** `<|`, hasn't input any start tag name. */
	getEmptyNameStartTagCompletions(): TS.CompletionInfo | null {
		let components = this.analyzer.getComponentsForCompletion('')
		return this.makeCompletionInfo(components)
	}
	
	getSlotCompletions(slot: TemplateSlot): TS.CompletionInfo | null {
		
		// <
		if (slot.type === TemplateSlotType.StartTagOpen) {
			let components = this.analyzer.getComponentsForCompletion('')
			return this.makeCompletionInfo(components, slot)
		}

		// tag
		else if (slot.type === TemplateSlotType.StartTag) {
			let components = this.analyzer.getComponentsForCompletion(slot.attrName)
			return this.makeCompletionInfo(components, slot)
		}

		// :xxx
		else if (slot.type === TemplateSlotType.Binding) {
			let items = this.getBindingCompletionItems(slot, contextNode)
			return this.makeCompletionInfo(items, slot)
		}

		// .xxx
		else if (slot.type === TemplateSlotType.Property) {
			let items = this.getPropertyCompletionInfo(slot)
			return this.makeCompletionInfo(items, slot)
		}

		// xxx="|"
		else if (slot.attrValue !== null) {
			return null
		}

		// ?xxx
		else if (slot.type === TemplateSlotType.BooleanAttribute) {
			let properties = filterBooleanAttributeForCompletion(slot.attrName, slot.tagName)
			let items = addSuffixProperty(properties, '=', slot)

			return this.makeCompletionInfo(items, slot)
		}

		// @xxx
		else if (slot.type === TemplateSlotType.DomEvent) {
			let items = this.getEventCompletionItems(slot) as {name: string, description: string | null}[]

			if (slot.tagName.includes('-') && !slot.attrName.includes('.')) {
				let comEvents = this.analyzer.getComponentEventsForCompletion(slot.attrName, slot.tagName) || []
				let atComEvents = comEvents.map(item => ({name: '@' + item.name, description: item.description}))

				items.unshift(
					...addSuffixProperty(atComEvents, '=', slot)
				)
			}

			return this.makeCompletionInfo(items, slot)
		}

		// @@xxx
		else if (slot.type === TemplateSlotType.ComEvent) {
			let comEvents = this.analyzer.getComponentEventsForCompletion(slot.attrName, slot.tagName) || []
			let info = addSuffixProperty(comEvents, '=', slot)

			return this.makeCompletionInfo(info, slot)
		}

		return null
	}

	private getBindingCompletionItems(token: FlitToken, contextNode: TS.Node) {
		let [bindingName, modifiers] = splitPropertyAndModifiers(token.attrName)

		// `:ref="|"`.
		if (token.attrValue !== null) {
			let attrValue = token.attrValue.replace(/^['"](.*?)['"]$/, '$1')

			// Moves token range to `"|???|"`.
			token.attrPrefix = ''
			token.start += 1
			token.end -= 1

			if (['ref', 'slot'].includes(token.attrName)) {
				let customTagName: string | null = null
				let componentPropertyName = token.attrName + 's' as 'refs' | 'slots'

				// Get ancestor class declaration.
				if (token.attrName === 'ref') {
					let declaration = findNodeAscent(contextNode, child => this.typescript.isClassLike(child)) as TS.ClassLikeDeclaration
					if (!declaration) {
						return null
					}

					customTagName = this.analyzer.getComponentByDeclaration(declaration)?.name || null
				}
				// Get closest component tag.
				else {
					customTagName = token.closestCustomTagName
				}

				if (!customTagName) {
					return null
				}

				let items = this.analyzer.getSubPropertiesForCompletion(componentPropertyName, attrValue, customTagName)
				return items
			}

			// `:model="|"`.
			else if (['model', 'refComponent'].includes(token.attrName)) {
				let declaration = findNodeAscent(contextNode, child => this.typescript.isClassLike(child)) as TS.ClassLikeDeclaration
				if (!declaration) {
					return null
				}

				let customTagName = this.analyzer.getComponentByDeclaration(declaration)?.name || null
				if (!customTagName) {
					return null
				}

				let items = this.analyzer.getComponentPropertiesForCompletion(attrValue, customTagName, false)
				return items
			}
		}
		
		// `:show`, without modifiers.
		if (modifiers.length === 0) {
			let bindings = this.analyzer.getBindingsForCompletion(token.attrName)
			let items = addSuffixProperty(bindings, '=', token)

			// `:class` or `:style`, `:model` may have `.` followed.
			items.forEach(item => {
				if (item.name === 'class' || LuposBindingModifiers.hasOwnProperty(item.name)) {
					item.suffix = ''
				}
			})

			return items
		}

		if (bindingName === 'style') {
			// Complete modifiers.
			if (modifiers.length === 1) {

				// Move cursor to `:style|.`
				token.start += 1 + bindingName.length
				token.attrPrefix = '.'

				let items = filterForCompletion(DOMStyleProperties, modifiers[0])
				return items
			}

			// Complete style property.
			else {

				// Move cursor to `:style.font-size|.`
				token.start += 1 + bindingName.length + 1 + modifiers[0].length
				token.attrPrefix = '.'

				let items = filterForCompletion(LuposBindingModifiers.style, modifiers[modifiers.length - 1])
				return addSuffixProperty(items, '=', token)
			}
		}
		else if (bindingName === 'model') {

			// Move cursor to `:model???|.`
			token.start = token.end - (1 + modifiers[modifiers.length - 1].length)
			token.attrPrefix = '.'

			let items = filterForCompletion(LuposBindingModifiers.model, modifiers[modifiers.length - 1])
			return items
		}

		// Completion of `:class` will be handled by `CSS Navigation` plugin.

		return null
	}

	private getPropertyCompletionInfo(token: FlitToken) {
		// If `.property="|"`.
		if (token.attrValue !== null) {
			let attrValue = token.attrValue.replace(/^['"](.*?)['"]$/, '$1')

			// Moves token range to `"|???|"`.
			token.attrPrefix = ''
			token.start += 1
			token.end -= 1

			// For `<f-icon .type="|">`
			if (token.tagName.includes('icon') && token.attrName === 'type') {
				let icons = this.analyzer.getIconsForCompletion(attrValue)
				return icons
			}

			// For `type="a" | "b" | "c"`
			else {
				let property = this.analyzer.getComponentProperty(token.attrName, token.tagName)
				if (!property) {
					return null
				}

				let typeStringList = this.analyzer.getTypeUnionStringList(property.type)

				return typeStringList.map(name => {
					return {
						name,
						description: null,
					}
				})
			}
		}

		// .property|
		else {
			let properties = this.analyzer.getComponentPropertiesForCompletion(token.attrName, token.tagName) || []
			return properties
		}
	}
	
	private getEventCompletionItems(token: FlitToken) {
		let [eventName, modifiers] = splitPropertyAndModifiers(token.attrName)

		// `@click`, without modifiers.
		if (modifiers.length === 0) {
			let items = filterForCompletion(DOMElementEvents, token.attrName)
			return items
		}

		// `@click.l`, with modifiers.
		else {

			// Move cursor to `@click???|.l`
			token.start = token.end - (1 + modifiers[modifiers.length - 1].length)
			token.attrPrefix = '.'

			// .passive, .stop, ...
			let items = filterForCompletion(LuposDomEventModifiers.global, modifiers[modifiers.length - 1])

			// .left, .right.
			if (LuposEventCategories[eventName]) {
				let category = LuposEventCategories[eventName]
				items.push(...filterForCompletion(LuposDomEventModifiers[category], modifiers[modifiers.length - 1]))
			}

			return items
		}
	}

	private makeCompletionInfo(
		items: {name: string, description: string | null, suffix?: string}[] | null,
		token: FlitToken,
	): TS.CompletionInfo | null {
		if (!items) {
			return null
		}

		let entries: TS.CompletionEntry[] = items.map(item => {
			let name = token.attrPrefix + item.name
			let kind = getScriptElementKindFromToken(token, this.typescript)

			let replacementSpan: TS.TextSpan = {
				start: token.start,
				length: token.end - token.start,
			}

			return {
				name,
				kind,
				sortText: item.name,
				insertText: name + (item.suffix || ''),
				replacementSpan,
			}
		})

		return {
			isGlobalCompletion: false,
			isMemberCompletion: false,
			isNewIdentifierLocation: false,
			entries: entries,
		}
	}

	getNonTemplateCompletions(fileName: string, offset: number): TS.CompletionInfo | null {
		let simulateToken = getSimulateTokenFromNonTemplate(fileName, offset, this.analyzer.program, this.typescript)
		if (simulateToken) {
			return this.getSlotCompletions(simulateToken.token, simulateToken.node)
		}

		return null
	}
}


function filterForCompletion<T extends {name: string}>(items: T[], label: string): T[] {
	return items.filter(item => item.name.startsWith(label))
}


function filterBooleanAttributeForCompletion(label: string, tagName: string): CompleteBooleanAttribute[] {
	return DOMBooleanAttributes.filter(item => {
		if (item.forElements && !item.forElements.includes(tagName)) {
			return false
		}

		return item.name.startsWith(label)
	})
}


function addSuffixProperty(items: {name: string, description: string | null}[], suffix: string, token: FlitToken) {
	if (suffix && token.nextTokenString.startsWith(suffix)) {
		suffix = ''
	}

	return items.map(item => ({
		name: item.name,
		description: item.description,
		suffix,
	}))
}
