import {JSTokenScanner, ScanState} from './tokens'


/** Test whether language is typescript language. */
export function isTypeScriptLanguage(languageId: string) {
	return languageId === 'typescript' || languageId === 'typescriptreact'
}


/** Check whether inside template literal. */
export function isInsideTemplateSyntax(textBefore: string): boolean {
	let scanner = new JSTokenScanner(textBefore, 0)
	let state = scanner.scanForFinalState()

	return state === ScanState.WithinTemplateLiteral
}


/** Test whether starts with `<`, but not end. */
export function isLineStartTagButNotEnd(line: string) {
	return /^\t+<\w[^>]*?$/.test(line.trim())
}