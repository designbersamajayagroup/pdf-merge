'use strict'

import Lexer from './lexer'
import * as objects from '../object'
import {toArrayBuffer} from '../util'

const { PDFXref, PDFTrailer, PDFDictionary, PDFObject, PDFReference } = objects

export default class Parser {
  // ab ... ArrayBuffer
  constructor(ab) {
    this.src = new Uint8Array(toArrayBuffer(ab))
  }

  async parse() {
    let index = lastIndexOf(this.src, 'startxref', 128)
    if (index === -1) {
      throw new Error('Invalid PDF: startxref not found')
    }

    index += 'startxref'.length

    // skip whitespaces
    while (Lexer.isWhiteSpace(this.src[++index])) {
    }

    let str = ''
    while (this.src[index] >= 0x30 && this.src[index] <= 0x39) { // between 0 and 9
      str +=  String.fromCharCode(this.src[index++])
    }

    const startXRef = parseInt(str, 10)

    if (isNaN(startXRef)) {
      throw new Error('Invalid PDF: startxref is not a number')
    }

    const lexer = new Lexer(this.src)
    lexer.shift(startXRef)

    this.xref    = await PDFXref.parse.call(objects, null, lexer)
    this.trailer = this.xref.trailer || await PDFTrailer.parse.call(objects, this.xref, lexer)

    let trailer = this.trailer
    while (trailer.has('Prev')) {
      lexer.pos = trailer.get('Prev')
      const xref = await PDFXref.parse.call(objects, null, lexer)

      for (let i = 0; i < xref.objects.length; ++i) {
        const obj = xref.objects[i]
        if (obj && !this.xref.objects[i]) {
          this.xref.objects[i] = obj
        }
      }

      trailer = xref.trailer || await PDFTrailer.parse.call(objects, xref, lexer)
    }
  }

  static addObjectsRecursive(objects, value) {
    switch (true) {
      case value instanceof PDFReference:
        if (objects.indexOf(value.object) > -1) {
          break
        }
        objects.push(value.object)
        Parser.addObjectsRecursive(objects, value.object)
        break
      case value instanceof PDFObject:
        Parser.addObjectsRecursive(objects, value.properties)
        Parser.addObjectsRecursive(objects, value.content)
        break
      case value instanceof PDFDictionary:
        for (const key in value.dictionary) {
          Parser.addObjectsRecursive(objects, value.dictionary[key])
        }
        break
      case Array.isArray(value):
        value.forEach(function(item) {
          Parser.addObjectsRecursive(objects, item)
        })
        break
    }
  }
}

function lastIndexOf(src, key, step) {
  if (!step) step = 1024
  let pos = src.length, index = -1

  while (index === -1 && pos > 0) {
    pos -= step - key.length
    index = find(src, key, Math.max(pos, 0), step, true)
  }

  return index
}

function find(src, key, pos, limit, backwards) {
  if (pos + limit > src.length) {
    limit = src.length - pos
  }

  const str = String.fromCharCode.apply(null, src.subarray(pos, pos + limit))
  let index = backwards ? str.lastIndexOf(key) : str.indexOf(key)
  if (index > -1) {
    index += pos
  }
  return index
}