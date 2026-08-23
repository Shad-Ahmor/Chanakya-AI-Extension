# XML

## Core Principles
- Validate XML against its schema (XSD, DTD, or RelaxNG) before processing.
- Use a proper XML parser — never parse XML with regex or string splitting.
- Never build XML by concatenating strings with user-supplied values — use a DOM API or serialization library to prevent XML injection.

## Parsing
- Use language-native XML parsers: `DOMParser` (browser), `ElementTree` (Python), `DocumentBuilder` (Java), `XmlDocument` (.NET), `DOMDocument` (PHP).
- Disable external entity processing (XXE) when parsing untrusted XML:
  - Java: `factory.setFeature("http://xml.org/sax/features/external-general-entities", false)`
  - Python: Use `defusedxml` library instead of `xml.etree.ElementTree`
  - PHP: `libxml_disable_entity_loader(true)` (pre PHP 8.0)

## Structure
- Use descriptive element and attribute names. Use attributes for metadata, elements for content.
- Use XML namespaces (`xmlns`) when integrating multiple XML vocabularies.

## Security
- XML External Entity (XXE) injection: Disable external entity processing in ALL XML parsers handling untrusted input.
- XML Entity Expansion (Billion Laughs / XML Bomb): Use parsers with entity expansion limits.
- Never use XSLT with untrusted stylesheets — XSLT can execute arbitrary code in some processors.

## Verification Checklist
- [ ] Is XML validated against its schema before processing?
- [ ] Is a proper XML parser used — not regex or string splitting?
- [ ] Is external entity processing disabled for untrusted XML input?
- [ ] Is XML built via a DOM API — not string concatenation?
