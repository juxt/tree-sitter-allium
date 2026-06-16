#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stdint.h>
#include <string.h>

// External token: a newline that terminates a block item.
//
// Allium separates block items (entity fields, value-type fields, config
// parameters, rule/surface clauses, ...) by newlines, with commas as an
// optional single-line alternative (see the language reference: "newlines are
// the standard separator for multi-line declarations"). Tree-sitter treats
// whitespace -- including newlines -- as `extras`, so without this scanner the
// grammar cannot tell where one field ends and the next begins. The
// `infix_predicate_expression` rule (`subject predicate`, two adjacent
// identifiers) then greedily bridges the gap, so `bar: String\nbaz: String`
// parses `String baz` as one expression and errors on the trailing `: String`.
//
// This scanner emits a zero-context separator at a newline only when the
// following line does NOT continue the current expression -- i.e. it does not
// begin with an infix/postfix operator (`or`, `and`, `.`, `-`, `|`, ...) or an
// `else` clause. Comments are left to the internal lexer: when the scanner is
// first invoked the comment precedes the newline, so no newline has been seen
// yet and the scanner defers; it is re-invoked at the newline after the comment
// node has been produced.

enum TokenType {
    ITEM_SEPARATOR,
};

void *tree_sitter_allium_external_scanner_create(void) { return NULL; }
void tree_sitter_allium_external_scanner_destroy(void *payload) { (void)payload; }
unsigned tree_sitter_allium_external_scanner_serialize(void *payload, char *buffer) {
    (void)payload;
    (void)buffer;
    return 0;
}
void tree_sitter_allium_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
    (void)payload;
    (void)buffer;
    (void)length;
}

// Keyword operators that, at the start of a line, continue the previous
// expression rather than beginning a new block item. `else` continues an
// `if` block; the rest are infix operators.
static bool is_continuation_keyword(const char *word, unsigned len) {
    static const char *const keywords[] = {
        "or", "and", "not", "in", "when", "with", "where", "implies", "else",
    };
    for (unsigned i = 0; i < sizeof(keywords) / sizeof(keywords[0]); i++) {
        if (strlen(keywords[i]) == len && strncmp(word, keywords[i], len) == 0) {
            return true;
        }
    }
    return false;
}

bool tree_sitter_allium_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    (void)payload;
    if (!valid_symbols[ITEM_SEPARATOR]) {
        return false;
    }

    bool saw_newline = false;
    for (;;) {
        int32_t c = lexer->lookahead;
        if (c == '\n' || c == '\r') {
            saw_newline = true;
            lexer->advance(lexer, true);
        } else if (c == ' ' || c == '\t') {
            lexer->advance(lexer, true);
        } else {
            break;
        }
    }

    if (!saw_newline) {
        return false;
    }

    // The separator ends here, before the next token. Any further `advance`
    // calls only look ahead; they do not extend the token.
    lexer->mark_end(lexer);

    int32_t c = lexer->lookahead;

    // Symbolic operators / punctuation that continue the previous expression
    // (or `,`, which is itself a separator -- avoid emitting two in a row).
    // `-` covers both the `-`/`->` operators and the `--` comment start.
    switch (c) {
        case '|':
        case '?':
        case '.':
        case '-':
        case '=':
        case '!':
        case '<':
        case '>':
        case '+':
        case '*':
        case '/':
        case ',':
        case 0: // end of input: nothing left to separate
            return false;
        default:
            break;
    }

    // Keyword operators that continue the previous expression.
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_') {
        char word[16];
        unsigned len = 0;
        for (;;) {
            int32_t d = lexer->lookahead;
            bool word_char = (d >= 'a' && d <= 'z') || (d >= 'A' && d <= 'Z') ||
                             (d >= '0' && d <= '9') || d == '_';
            if (!word_char || len >= sizeof(word) - 1) {
                break;
            }
            word[len++] = (char)d;
            lexer->advance(lexer, false);
        }
        word[len] = 0;
        if (is_continuation_keyword(word, len)) {
            return false;
        }
    }

    lexer->result_symbol = ITEM_SEPARATOR;
    return true;
}
