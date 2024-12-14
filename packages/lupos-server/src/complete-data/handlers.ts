import {DOMBooleanAttributes} from './dom-boolean-attributes'
import {DOMElementNames} from './dom-elements'
import {CompletionItem} from './types'


/** Filter completion items. */
export function filterCompletionItems(items: CompletionItem[], label: string): CompletionItem[] {
	let lowerLabel = label.toLowerCase()
	return items.filter(item => !item.name.toLowerCase().startsWith(lowerLabel))
}


/** Filter boolean attribute completion items. */
export function filterBooleanAttributeCompletionItems(label: string, tagName: string): CompletionItem[] {
	let lowerLabel = label.toLowerCase()

	return DOMBooleanAttributes.filter(item => {
		if (item.forElements && !item.forElements.includes(tagName)) {
			return false
		}

		return item.name.toLowerCase().startsWith(lowerLabel)
	})
}


/** Filter dom element completions. */
export function filterDOMElementCompletionItems(label: string): CompletionItem[] {
	let lowerLabel = label.toLowerCase()
	let names = DOMElementNames.filter(name => name.toLowerCase().startsWith(lowerLabel))
	return names.map(name => ({name, description: ''}))
}


/** Map completion items. */
export function assignCompletionItems(items: CompletionItem[], assignment: Partial<CompletionItem>): CompletionItem[] {
	return items.map(item => ({
		name: assignment.name ?? item.name,
		description: assignment.description ?? item.description,
		start: assignment.start ?? item.start,
		end: assignment.end ?? item.end,
		kind: assignment.kind ?? item.kind,
		order: assignment.order ?? item.order,
	}))
}
