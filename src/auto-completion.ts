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
	if (event.contentChanges.length === 0) {
		return
	}

	if (!isTypeScriptLanguage(event.document.languageId)) {
		return
	}

	// Typing `>` for a closing HTML tag can trigger VS Code's electric
	// indentation and remove the leading whitespace. Depending on the VS Code
	// version, that removal may or may not be included as a separate change.
	let indentDeletion = event.contentChanges.find(change => {
		return change.text === ''
			&& change.range.start.line === change.range.end.line
			&& change.range.start.character === 0
			&& change.range.end.character > 0
	})
	let closingTagInput = event.contentChanges.find(change => change.text.includes('>'))
	let affectedLine = indentDeletion?.range.start.line ?? closingTagInput?.range.start.line

	if (affectedLine !== undefined && restoreClosingTagIndent(event.document, affectedLine, indentDeletion)) {
		return
	}

	let start = event.contentChanges[0].rangeOffset
	let insertText = event.contentChanges[0].text

	if (!insertText) {
		return
	}

	autoInsertTemplateSlot(start, insertText)
}


/** Restore whitespace removed by VS Code's closing-tag electric indentation. */
function restoreClosingTagIndent(
	document: vscode.TextDocument,
	lineNumber: number,
	indentDeletion?: vscode.TextDocumentContentChangeEvent
): boolean {
	let editor = vscode.window.activeTextEditor
	if (!editor || editor.document !== document) {
		return false
	}

	let line = document.lineAt(lineNumber).text
	let closingTagMatch = line.match(/^(\s*)<\/([\w:$-]+)>/)
	if (!closingTagMatch) {
		return false
	}

	let lineStart = document.offsetAt(new vscode.Position(lineNumber, 0))
	let scanner = new JSTokenScanner(document.getText().slice(0, lineStart), 0)
	if (scanner.scanForFinalState() !== ScanState.WithinTemplateLiteral) {
		return false
	}

	let currentIndent = closingTagMatch[1]
	let tagName = closingTagMatch[2]
	let templateTextBefore = document.getText().slice(scanner.startTemplateQuoteOffset + 1, lineStart)
	let expectedIndent = findUnmatchedOpeningTagIndent(templateTextBefore, tagName)

	// The deletion range is a fallback for incomplete markup where the opening
	// tag can't be recovered. Normal closing tags copy the exact tabs/spaces of
	// their matching opening tag.
	if (expectedIndent === null && indentDeletion) {
		expectedIndent = '\t'.repeat(indentDeletion.range.end.character)
	}

	if (expectedIndent === null
		|| expectedIndent.length <= currentIndent.length
		|| !expectedIndent.startsWith(currentIndent)
	) {
		return false
	}

	let indent = expectedIndent.slice(currentIndent.length)
	let cursor = editor.selection.active
	let insertPosition = new vscode.Position(lineNumber, 0)

	void editor.edit(editBuilder => {
		editBuilder.insert(insertPosition, indent)
	}).then(() => {
		if (cursor.line === lineNumber) {
			let cursorPosition = cursor.translate(0, indent.length)
			editor.selection = new vscode.Selection(cursorPosition, cursorPosition)
		}
	})

	return true
}


/** Find the indentation of the last unmatched opening tag with this name. */
function findUnmatchedOpeningTagIndent(text: string, tagName: string): string | null {
	let escapedName = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	let tagRE = new RegExp(`<\\/?${escapedName}(?=[\\s/>])[^>]*>`, 'g')
	let openingIndents: string[] = []

	for (let match of text.matchAll(tagRE)) {
		if (match[0].startsWith('</')) {
			openingIndents.pop()
		}
		else if (!match[0].endsWith('/>')) {
			let lineStart = text.lastIndexOf('\n', match.index! - 1) + 1
			let linePrefix = text.slice(lineStart, match.index)
			openingIndents.push(/^\s*$/.test(linePrefix) ? linePrefix : '')
		}
	}

	return openingIndents.at(-1) ?? null
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

	// VS Code may insert a backtick pair when typing the closing quote of an
	// embedded template. Keep the typed closing quote and remove the auto-added one.
	if (insertedText === '``') {
		let cursorPosition = document.positionAt(start + 1)
		let redundantQuoteEnd = document.positionAt(start + 2)

		await editor.edit(editBuilder => {
			editBuilder.delete(new vscode.Range(cursorPosition, redundantQuoteEnd))
		})

		editor.selection = new vscode.Selection(cursorPosition, cursorPosition)
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
