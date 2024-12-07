import type * as TS from 'typescript'
import {PluginConfig} from './config'


/**
 * Provide logger service, can be used to pass from ts service to template language service.
 * See
 * https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin
 * https://github.com/microsoft/TypeScript/wiki/Standalone-Server-%28tsserver%29
 * 
 * Firstly set environment variable `TSS_LOG=-logToFile true -level verbose -file "C:\Users\UserName\Desktop\ts.log"`
 * Then copy following codes and put it to a js file at `C:\Users\UserName\Desktop`, run it.
 */


/*
const fs = require('fs')

const filename = __dirname + '/ts.log'
const filteredFileName = __dirname + '/ts-filtered.log'

function filterLog() {
	let text = fs.readFileSync(filename).toString('utf8')
	let matches = [...text.matchAll(/(Info|Err|Perf) \d+ +\[\d\d:\d\d:\d\d.\d\d\d\]/g)]
	let output = []

	for (let i = 0; i < matches.length; i++) {
		let match = matches[i]
		let start = match.index
		let end = i < matches.length - 1 ? matches[i + 1].index : text.length
		let msg = text.slice(start, end)
		let type = match[1]

		if (type === 'Err') {
			output.push(msg.trim())
		}
		else if (type === 'Info' && msg.includes('[lupos-server]')) {
			output.push(msg.replace('[lupos-server]').trim())
		}
	}

	console.log('Log file filtered')
	fs.writeFileSync(filteredFileName, output.join('\n' + '-'.repeat(60) + '\n'))
}

filterLog()
fs.watch(filename, filterLog)

*/


export namespace Logger {

	let logger: TS.server.Logger

	/** Initialize after captured plugin create info. */
	export function initialize(theLogger: TS.server.Logger) {
		logger = theLogger
	}

	export function log(message: any) {
		if (message && typeof message === 'object') {
			message = JSON.stringify(message)
		}

		logger.info(`[${PluginConfig.pluginName}] ${message}`)
	}
}

