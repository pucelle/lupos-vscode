import {DOMBooleanAttributes} from './dom-boolean-attributes'
import {DOMElementNames} from './dom-elements'
import {LuposBindingModifiers} from './lupos-binding-modifiers'
import {LuposSimulatedEvents} from './lupos-simulated-events'
import {CompletionItem} from './types'


/** Filter completion items. */
export function filterCompletionItems(items: CompletionItem[], label: string): CompletionItem[] {
	return items.filter(item => item.name.startsWith(label))
}


/** Find unique completion item where name fully match. */
export function findFullyMatchedCompletionItem(items: CompletionItem[], name: string): CompletionItem | undefined {
	return items.find(item => item.name === name)
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


/** Get modifier completion items. */
export function getBindingModifierCompletionItems(mainName: string, modifiers: string[], available: string[] | null) {
	
	// Use known binding modifiers.
	if (!available) {
		available = LuposBindingModifiers[mainName]?.map(item => item.name)
	}

	// Filter out existing group when current modifier is empty.
	if (available && LuposBindingModifiers[mainName]) {
		let existingGroups = modifiers.map(m => LuposBindingModifiers[mainName].find(item => item.name === m)?.group).filter(v => v !== undefined)

		available = available.filter(m => {
			let group = LuposBindingModifiers[mainName].find(item => item.name === m)?.group
			if (group === undefined) {
				return true
			}

			return !existingGroups.includes(group)
		})
	}

	if (!available) {
		return []
	}

	// Make modifier completion items by names.
	let items: CompletionItem[] = available.map(m => {
		let luposBindingItem = LuposBindingModifiers[mainName].find(item => item.name === m)

		return {
			name: m,
			description: luposBindingItem?.description || '',
		}
	})

	return items
}


/** Map completion items. */
export function mapCompletionItems(items: CompletionItem[], map: (item: CompletionItem) => CompletionItem): CompletionItem[] {
	return items.map(item => map({
		name: item.name,
		description: item.description,
		start: item.start,
		end: item.end,
	}))
}


/** Map completion items. */
export function assignCompletionItems(items: CompletionItem[], assignment: Partial<CompletionItem>): CompletionItem[] {
	return items.map(item => ({
		name: assignment.name ?? item.name,
		description: assignment.description ?? item.description,
		start: assignment.start ?? item.start,
		end: assignment.end ?? item.end,
	}))
}


/** Test whether an event name represents a simulated event. */
export function isSimulatedEventName(name: string): boolean {
	return !!LuposSimulatedEvents.find(item => item.name === name)
}
