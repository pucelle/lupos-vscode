import * as vscode from 'vscode'
import {getIndentCount, isLineStartTagButNotEnd, isTypeScriptLanguage} from './utils'
import {JSTokenScanner, ScanState} from './tokens'


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

	let scanner = new JSTokenScanner(textBefore, 0)
	let state = scanner.scanForFinalState()

	// Must within template literal.
	if (state !== ScanState.WithinTemplateLiteral) {
		return
	}

	let templateStartOffset = scanner.startTemplateQuoteOffset

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

	if (insertedText.startsWith('\n')) {
			
		// Insert char end offset, also start of old chars.
		let end = start + insertedText.length
		let position = document.positionAt(start)
		let tagStartLine = getPreviousTagStartLine(position, document)
		let charAfter = document.getText().slice(end, end + 1)
		let charsAfter = document.getText().slice(end, end + 2)
		let insertIndentCount = getIndentCount(insertedText.slice(1))

		// Input `\n` inside a `<...>`, add a tab to the new line.
		if (tagStartLine) {
			let tagIndentCount = getIndentCount(tagStartLine)
			
	
			if (insertIndentCount <= tagIndentCount && !(charAfter === '>' || charsAfter === '/>')) {
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

		// Input `\n` before `/>` or `>`, eat a tab.
		else if (charAfter === '>' || charsAfter === '/>') {
			let endLine = document.lineAt(document.positionAt(end)).text
			let tagIndentCount = getIndentCount(endLine)

			if (tagIndentCount > 0) {
				let endPosition = document.positionAt(end)
				let startPosition = document.positionAt(end - 1)
				let range = new vscode.Range(startPosition, endPosition)

				// Delete a tab after inserted text.
				await editor.edit(editBuilder => {
					editBuilder.delete(range)
				})
			}
		}

		// Input `\n` before '`', eat tabs to persist same with tabs at start template quote '`'.
		else if (charAfter === '`') {
			let startQuoteLine = document.lineAt(document.positionAt(templateStartOffset)).text
			let startIndentCount = getIndentCount(startQuoteLine)

			if (insertIndentCount > startIndentCount) {
				let endPosition = document.positionAt(end)
				let startPosition = document.positionAt(end - (insertIndentCount - startIndentCount))
				let range = new vscode.Range(startPosition, endPosition)

				// Delete a tab after inserted text.
				await editor.edit(editBuilder => {
					editBuilder.delete(range)
				})
			}
		}
	}
}

/** Get `<...` at same line, or at previous line if current line is totally white spaces. */
function getPreviousTagStartLine(position: vscode.Position, document: vscode.TextDocument): string | null {
	let startLine = document.lineAt(position).text

	if (isLineStartTagButNotEnd(startLine)) {
		return startLine
	}
	
	if (/^\s*$/.test(startLine) && position.line > 0) {
		let previousLine = document.lineAt(position.line - 1).text
		if (isLineStartTagButNotEnd(previousLine)) {
			return previousLine
		}
	}
	
	return null
}
