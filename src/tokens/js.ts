import {AnyTokenScanner} from './any'


const BRACKETS_MAP: Record<string, string> = {
	'(': ')',
	'[': ']',
	'{': '}',
}

export enum ScanState {
	EOF = 0,
	AnyContent = 1,
	WithinSingleLineComment,
	WithinMultiLineComment,
	WithinString,
	WithinTemplateLiteral,
}

const BracketRE = /[()\[\]{}"'`\/]/g


/** 
 * Scan for embedded html and css codes within js or ts files.
 * Note: this is a very simple scanner, it ignore template nesting.
 */
export class JSTokenScanner extends AnyTokenScanner {

	declare protected state: ScanState
	private bracketStack: string[] = []
	private bracketExpect: string | null = null

	/** Parse html string to tokens. */
	scanForFinalState(): ScanState {
		while (this.state !== ScanState.EOF) {
			if (this.state === ScanState.AnyContent) {
				this.onAnyContent()
			}
			else if (this.state === ScanState.WithinSingleLineComment) {
				this.onWithinSingleLineComment()
			}
			else if (this.state === ScanState.WithinMultiLineComment) {
				this.onWithinMultiLineComment()
			}
			else if (this.state === ScanState.WithinString) {
				this.onWithinString()
			}
			else if (this.state === ScanState.WithinTemplateLiteral) {
				this.onWithinTemplateLiteral()
			}
		}

		return this.endState
	}

	/** 
	 * Try read an bracketed expression like `[...]`, `(...)`, `{...}`.
	 * Must ensure the current char is one of `[{(`,
	 * and cursor must before start bracket `[{(`.
	 * brackets or quotes must appear in pairs.
	 * It stops after found all matching end brackets.
	 * Supported language js, css, sass, less.
	 */
	protected readBracketed(): boolean {
		while (this.state !== ScanState.EOF) {
			if (!this.readUntilToMatch(BracketRE)) {
				break
			}
			
			let char = this.peekChar()

			// `|"..."`
			if (char === '"' || char === '\'') {
				this.enterState(ScanState.WithinString)
				this.onWithinString()
				continue
			}
			
			// '|`...`'
			else if (char === '`') {
				this.enterState(ScanState.WithinTemplateLiteral)
				this.onWithinTemplateLiteral()
				continue
			}

			// `|//`
			else if (char === '/' && this.peekChar(1) === '/') {
				this.enterState(ScanState.WithinSingleLineComment)
				this.onWithinSingleLineComment()
				continue
			}

			// `|/*`
			else if (char === '/' && this.peekChar(1) === '*') {
				this.enterState(ScanState.WithinMultiLineComment)
				this.onWithinMultiLineComment()
				continue
			}

			// Eat the char.
			this.offset += 1

			if (char === this.bracketExpect) {
				if (this.bracketStack.length > 0) {
					this.bracketExpect = this.bracketStack.pop()!
				}
				else {
					break
				}
			}
			else if (char === '[' || char === '(' || char === '{') {
				if (this.bracketExpect) {
					this.bracketStack.push(this.bracketExpect)
				}

				this.bracketExpect = BRACKETS_MAP[char]
			}
		}

		return this.state !== ScanState.EOF
	}

	/** 
	 * Read a regexp expression like `/.../`.
	 * Cursor must locate at `|/`.
	 * Returns whether read a regexp.
	 */
	protected tryReadRegExp(): boolean {
		let withinCharList = false
		let startOffset = this.offset

		// Move cursor to `/|`
		this.offset += 1

		while (true) {
			if (!this.readOutToMatch(/[\\\[\]\/\r\n]/g)) {
				this.offset = startOffset + 1
				return false
			}

			let char = this.peekChar(-1)
			
			// `\|.`, skip next char, even within character list.
			if (char === '\\') {

				// Move to `\.|`
				this.offset += 1
			}

			// `[|`, start character list.
			else if (char === '[' && !withinCharList) {
				withinCharList = true
			}

			// `]|`, end character list.
			else if (char === ']' && withinCharList) {
				withinCharList = false
			}

			// `/|`, end regexp.
			else if (char === '/' && !withinCharList) {
				break
			}

			// Not correctly ended.
			else if (char === '\r' || char === '\n') {
				
				// Move to `/|` if failed to read regexp.
				this.offset = startOffset + 1
				
				return false
			}
		}

		// Skip regexp flags.
		!!this.readUntilToMatch(/[^a-z]/g)

		return true
	}

	protected onAnyContent() {

		// Parse for at most 100KB.
		if (this.offset > 100000) {
			this.state = ScanState.EOF
			return
		}

		if (!this.readUntilToMatch(/[`'"\/]/g)) {
			return
		}

		let char = this.peekChar()

		// `|//`
		if (char === '/' && this.peekChar(1) === '/') {
			this.enterState(ScanState.WithinSingleLineComment)
		}

		// `|/*`
		else if (char === '/' && this.peekChar(1) === '*') {
			this.enterState(ScanState.WithinMultiLineComment)
		}

		// `|/`, currently can't distinguish it from sign of division.
		else if (char === '/') {
			this.tryReadRegExp()
		}

		// `|'`
		else if (char === '\'' || char === '"') {
			this.enterState(ScanState.WithinString)
		}

		// '|`'
		else if (char === '`') {
			this.enterState(ScanState.WithinTemplateLiteral)
		}

		else {
			this.offset += 1
		}
	}

	protected onWithinSingleLineComment() {
	
		// Move to `//|`
		this.offset += 2

		// `|\n`
		if (!this.readLine()) {
			return
		}

		// Move to `\n|`
		this.offset += 1
		this.exitState()
	}

	protected onWithinMultiLineComment() {

		// Move to `/*|`
		this.offset += 2

		// `|*/`
		if (!this.readUntilToMatch(/\*\//g)) {
			return
		}

		// Move to `*/|`
		this.offset += 2
		this.exitState()
	}

	/** 
	 * Read string until position after end quote: `"..."|`.
	 * Cursor must before first quote `|"`.
	 */
	protected onWithinString() {
		let quote = this.peekChar()

		// Avoid read start quote.
		this.offset += 1

		while (true) {

			// "..."|
			if (!this.readOutToMatch(/['"\\$]/g)) {
				break
			}

			let char = this.peekChar(-1)
			
			if (char === quote) {
				break
			}

			// Skip next character.
			if (char === '\\') {
				this.offset += 1
			}
			
			// Read template literal.
			if (char === '$' && this.peekChar() === '{' && quote === '`') {
				if (!this.readBracketed()) {
					break
				}
			}
		}

		this.exitState()
	}

	/** Read `...`, must ensure the current char is |`. */
	protected onWithinTemplateLiteral() {
		let re = /[`\\$]/g

		// Avoid read start quote.
		this.offset += 1

		while (true) {
			if (!this.readOutToMatch(re)) {
				return
			}

			let char = this.peekChar(-1)
			
			if (char === '`') {
				break
			}

			else if (char === '$' && this.peekChar() === '{') {
				if (!this.readBracketed()) {
					return
				}
			}

			// Skip next character.
			else if (char === '\\') {
				this.offset += 1
			}
		}

		this.exitState()
	}
}
