/** Escape as regexp source text.`\.` -> `\\.` */
export function escapeAsRegExpSource(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}


/** `ab` -> /^ab/i. */
export function makeStartsMatchExp(text: string): RegExp {
	return new RegExp('^' + escapeAsRegExpSource(text), 'i')
}