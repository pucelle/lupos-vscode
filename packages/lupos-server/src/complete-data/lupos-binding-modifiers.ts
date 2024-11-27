/** 
 * Lupos binding which get compiled by compiler.
 * Other binding modifiers will detect by binding constructor.
 */
export const LuposBindingModifiers: Record<'style', CompleteDataItem[]> = {
	style: [
		{name: 'px', description: 'Add `px` unit to value.'},
		{name: 'percent', description: 'Add `%` unit to value.'},
		{name: 'url', description: 'Wrap computed value with `url()`.'},
	],
}