import {DOMBooleanAttributes} from './dom-boolean-attributes'
import {DOMElementNames} from './dom-elements'
import {CompletionItem} from './types'


/** Filter completion items. */
export function filterCompletionItems(items: CompletionItem[], label: string): CompletionItem[] {
	return items.filter(item => item.name.startsWith(label))
}


/** Filter boolean attribute completion items. */
export function filterBooleanAttributeCompletionItems(label: string, tagName: string): CompletionItem[] {
	return DOMBooleanAttributes.filter(item => {
		if (item.forElements && !item.forElements.includes(tagName)) {
			return false
		}

		return item.name.startsWith(label)
	})
}


/** Filter dom element completions. */
export function filterDOMElementCompletionItems(label: string): CompletionItem[] {
	let names = DOMElementNames.filter(name => !label || name.startsWith(label))
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
