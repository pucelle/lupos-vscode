import * as vscode from 'vscode'
import {isTypeScriptLanguage} from './utils'


interface AutoInsertingItem {

	/** From string `=$`. */
	leftChar: string

	/** Cursor offset after inserting. */
	cursorOffset: number

	/** Insert string `{}` */
	insert: string
}

// May upgrade to `auto replacing items` to be more magic.
const AutoInsertingItems: AutoInsertingItem[] = [
	{
		leftChar: '=',
		cursorOffset: 1,
		insert: '{}',
	},
	{
		leftChar: '>',
		cursorOffset: 1,
		insert: '{}',
	}
]


/** 
 * Do auto completion and inserting for template literal:
 * `=${|}`
 */
export function autoCompletion(event: vscode.TextDocumentChangeEvent): void {
	if (!event.contentChanges[0]) {
		return
	}

	if (isTypeScriptLanguage(event.document.languageId) && event.contentChanges[0].text === '$') {
		autoInsertTemplateSlot()
	}
}


/** Insert some characters when match. */
async function autoInsertTemplateSlot() {
	let editor = vscode.window.activeTextEditor
	if (!editor) {
		return
	}

	// Cursor is here: `=|$`.
	let document = editor.document
	let selection = editor.selection

	for (let {leftChar, insert, cursorOffset} of AutoInsertingItems) {
		let char = getPreviousNonEmptyChar(document, selection.active)
		if (char === leftChar) {
			let insertPosition = selection.active.translate(0, 1)

			// Insert `{}` after `=$`.
			await editor.edit(editBuilder => {
				editBuilder.insert(insertPosition, insert)
			})

			// Moves cursor to `{|}`
			let cursorPosition = insertPosition.translate(0, cursorOffset)
			editor.selection = new vscode.Selection(cursorPosition, cursorPosition)

			break
		}
	}
}


/** Try get previous non-empty char. */
function getPreviousNonEmptyChar(document: vscode.TextDocument, position: vscode.Position): string | undefined {
	let offset = document.offsetAt(position)
	
	for (let i = offset - 1; i >= 0; i--) {
		let p = document.positionAt(i)
		let line = document.lineAt(p).text

		// At the end of line.
		if (p.character >= line.length) {
			continue
		}

		let char = line[p.character]
		
		if (!/\s/.test(char)) {
			return char
		}
	}

	return undefined
}

