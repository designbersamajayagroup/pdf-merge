export async function parse(xref, lexer) {
  const Objects = [
    this.PDFBoolean,
    this.PDFNull,
    this.PDFName,
    this.PDFDictionary, // must be tried before string!
    this.PDFString,
    this.PDFArray,
    this.PDFReference, // must be tried before number!
    this.PDFNumber,
  ]

  console.log(lexer.getString(10))

  // try
  for (let i = 0; i < Objects.length; ++i) {
    const value = await Objects[i].parse.call(this, xref, lexer, true)
    if (value !== undefined) {
      return value
    }
  }

  lexer._error('Invalid value')
  return undefined
}