/** Test whether language is typescript language. */
export function isTypeScriptLanguage(languageId: string) {
	return languageId === 'typescript' || languageId === 'typescriptreact'
}


/** Test whether starts with `<`, but not end. */
export function isLineStartTagButNotEnd(line: string) {
	return /^\t+<\w[^>]*?$/.test(line)
}

/** Get indent count. */
export function getIndentCount(line: string): number {
	return line.match(/^(\t+)/)?.[0]?.length ?? 0
}