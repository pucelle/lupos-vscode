import * as vscode from 'vscode'
import {isInsideTemplateSyntax, isLineStartTagButNotEnd, isTypeScriptLanguage} from './utils'


interface AutoInsertingItem {

	/** From string `=$`. */
	leftChar: string

	/** Cursor offset after inserting. */
	cursorOffset: number

	/** Insert string `{}` */
	insert: string
}

// May upgrade to `auto replacing items` to be more magic.
const AutoInsertedItems: AutoInsertingItem[] = [
	{
		leftChar: '$',
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

	if (!isTypeScriptLanguage(event.document.languageId)) {
		return
	}

	let start = event.contentChanges[0].rangeOffset
	let insertText = event.contentChanges[0].text

	if (!insertText) {
		return
	}

	autoInsertTemplateSlot(start, insertText)
}


/** Insert some characters when match. */
async function autoInsertTemplateSlot(start: number, insertedText: string) {
	let editor = vscode.window.activeTextEditor

	// Not in typing recently.
	if (!editor) {
		return
	}

	// Cursor is here: `=|$`.
	let document = editor.document
	let textBefore = document.getText().slice(0, start)

	// Must within template literal.
	if (!isInsideTemplateSyntax(textBefore)) {
		return
	}

	for (let {leftChar, insert, cursorOffset} of AutoInsertedItems) {
		if (leftChar === insertedText) {
			let insertPosition = document.positionAt(start + 1)

			// Insert `{}` after `=$`.
			await editor.edit(editBuilder => {
				editBuilder.insert(insertPosition, insert)
			})

			// Moves cursor to `{|}`
			let cursorPosition = insertPosition.translate(0, cursorOffset)
			editor.selection = new vscode.Selection(cursorPosition, cursorPosition)

			return
		}
	}

	let position = document.positionAt(start)
	let line = document.lineAt(position).text
	
	// `<...`, no `>`
	if (!isLineStartTagButNotEnd(line)) {
		return
	}

	let tagIndentCount = line.match(/^\t+/)![0].length
	let insertIndentCount = insertedText.match(/\t+/)?.[0]?.length ?? 0

	if (insertIndentCount <= tagIndentCount) {
		let insertTab = '\t'.repeat(insertIndentCount + 1 - tagIndentCount)
		let insertTabPosition = document.positionAt(start + insertedText.length)

		// Insert new tabs after inserted text.
		await editor.edit(editBuilder => {
			editBuilder.insert(insertTabPosition, insertTab)
		})

		// Moves cursor to after tabs.
		let cursorPosition = insertTabPosition.translate(0, insertTab.length)
		editor.selection = new vscode.Selection(cursorPosition, cursorPosition)
	}
}


