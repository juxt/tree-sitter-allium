/**
 * Tree-sitter grammar for the Allium language (v3).
 *
 * Allium is a specification language with block-based declarations (rule,
 * entity, enum, config, given, surface, actor, value) and clause-driven
 * rule bodies (when:, requires:, ensures:).
 *
 * V3 additions: transition graphs, when-qualified fields, backtick literals,
 * for/if blocks, where/with/in/exists expressions, set literals.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  COMMA: 1,
  WHEN: 2,
  IMPLIES: 3,
  LAMBDA: 4,
  OR: 5,
  NULLISH_COALESCE: 6,
  AND: 7,
  NOT: 8,
  WHERE: 9,
  COMPARE: 10,
  ADD: 11,
  MULTIPLY: 12,
  INFIX: 13,
  PIPE: 14,
  CALL: 15,
  MEMBER: 16,
  PRIMARY: 17,
};

module.exports = grammar({
  name: "allium",

  word: ($) => $.identifier,

  extras: ($) => [$.comment, /[ \t\r\n]+/],

  conflicts: ($) => [
    [$.annotation],
  ],

  rules: {
    source_file: ($) =>
      seq(optional($.module_declaration), repeat($._top_level_item)),

    // -----------------------------------------------------------------------
    // Comments
    // -----------------------------------------------------------------------

    comment: (_) => token(seq("--", /[^\n]*/)),

    // -----------------------------------------------------------------------
    // Primitives
    // -----------------------------------------------------------------------

    identifier: (_) => /[A-Za-z_][A-Za-z0-9_]*/,

    backtick_literal: (_) => /`[^`]*`/,

    string_literal: ($) =>
      seq(
        '"',
        repeat(
          choice(
            token.immediate(/[^"\\{\n]+/),
            $.escape_sequence,
            $.string_interpolation,
          ),
        ),
        '"',
      ),

    escape_sequence: (_) => token.immediate(seq("\\", /./)),

    string_interpolation: ($) =>
      seq(token.immediate("{"), $.identifier, token.immediate("}")),

    // duration must be tried before plain number (longer match wins)
    duration_literal: (_) =>
      token(/\d+(\.\d+)?\.(seconds?|minutes?|hours?|days?|weeks?|months?|years?)/),

    number_literal: (_) => /\d+(\.\d+)?/,

    boolean_literal: (_) => choice("true", "false"),

    null_literal: (_) => "null",

    // -----------------------------------------------------------------------
    // Module header
    // -----------------------------------------------------------------------

    module_declaration: ($) => seq("module", field("name", $.identifier)),

    // -----------------------------------------------------------------------
    // Top-level declarations
    // -----------------------------------------------------------------------

    _top_level_item: ($) =>
      choice(
        $.use_declaration,
        $.rule_declaration,
        $.entity_declaration,
        $.external_entity_declaration,
        $.value_declaration,
        $.enum_declaration,
        $.given_block,
        $.config_block,
        $.surface_declaration,
        $.actor_declaration,
        $.default_declaration,
        $.variant_declaration,
        $.deferred_declaration,
        $.contract_declaration,
        $.invariant_declaration,
      ),

    use_declaration: ($) =>
      seq(
        "use",
        field("path", $.string_literal),
        optional(seq("as", field("alias", $.identifier))),
      ),

    rule_declaration: ($) =>
      seq("rule", field("name", $.identifier), field("body", $.block_body)),

    entity_declaration: ($) =>
      seq("entity", field("name", $.identifier), field("body", $.block_body)),

    external_entity_declaration: ($) =>
      seq(
        "external",
        "entity",
        field("name", $.identifier),
        field("body", $.block_body),
      ),

    value_declaration: ($) =>
      seq("value", field("name", $.identifier), field("body", $.block_body)),

    enum_declaration: ($) =>
      seq(
        "enum",
        field("name", $.identifier),
        field("body", choice($.block_body, $.enum_body)),
      ),

    // Enum body: pipe-separated or comma-separated values without key: value
    enum_body: ($) =>
      seq("{", field("values", choice($._expression, $.tuple_expression)), "}"),

    given_block: ($) => seq("given", field("body", $.block_body)),

    config_block: ($) => seq("config", field("body", $.block_body)),

    surface_declaration: ($) =>
      seq("surface", field("name", $.identifier), field("body", $.block_body)),

    actor_declaration: ($) =>
      seq("actor", field("name", $.identifier), field("body", $.block_body)),

    // "default [TypeName] instanceName = expression"
    default_declaration: ($) =>
      seq(
        "default",
        optional(field("type", $.identifier)),
        field("name", $.identifier),
        "=",
        field("value", $._expression),
      ),

    // "variant Name: sum_type_expression"
    variant_declaration: ($) =>
      seq(
        "variant",
        field("name", $.identifier),
        ":",
        field("type", $._expression),
      ),

    // "deferred path.expression"
    deferred_declaration: ($) =>
      seq("deferred", field("path", $._expression)),

    // "contract Name { ... }"
    contract_declaration: ($) =>
      seq("contract", field("name", $.identifier), field("body", $.block_body)),

    // "invariant Name { expr }" — expression-bearing invariant
    invariant_declaration: ($) =>
      seq("invariant", field("name", $.identifier), "{", field("body", $._expression), "}"),

    // -----------------------------------------------------------------------
    // Block body
    // -----------------------------------------------------------------------

    block_body: ($) => seq("{", repeat(seq($._block_item, optional(","))), "}"),

    _block_item: ($) =>
      choice(
        $.clause,
        $.field_assignment,
        $.let_binding,
        $.open_question,
        $.annotation,
        $.transition_block,
        $.for_block,
        $.if_block,
        $.invariant_block,
      ),

    // Clause: reserved keyword followed by colon and an expression
    clause: ($) =>
      seq(
        field("keyword", $.clause_keyword),
        ":",
        field("value", choice($._expression, $.tuple_expression)),
      ),

    // Clause keywords are reserved — the `word` rule ensures they cannot be
    // matched as plain identifiers.
    clause_keyword: (_) =>
      choice(
        "when",
        "requires",
        "ensures",
        "trigger",
        "provides",
        "tags",
        "guidance",
        "invariant",
        "becomes",
        "related",
        "exposes",
        "identified_by",
        "facing",
        "transitions_to",
        "guarantee",
        "timeout",
        "within",
        "contracts",
        "context",
      ),

    // Field assignment: plain identifier followed by colon and an expression
    field_assignment: ($) =>
      seq(
        field("key", $.identifier),
        ":",
        field("value", $._expression),
      ),

    // Let binding: "let name = expression"
    let_binding: ($) =>
      seq(
        "let",
        field("name", $.identifier),
        "=",
        field("value", $._expression),
      ),

    // open_question: 'open question "..."' marker
    open_question: ($) =>
      seq("open", "question", field("text", $.string_literal)),

    // Annotation: @invariant Name, @guidance, @guarantee Name
    annotation: ($) =>
      seq("@", field("kind", $.annotation_keyword), optional(field("name", $.identifier))),

    annotation_keyword: (_) => choice("invariant", "guidance", "guarantee"),

    // -----------------------------------------------------------------------
    // Transition graphs (v3)
    // -----------------------------------------------------------------------

    // "transitions field_name { edge... terminal: states }"
    transition_block: ($) =>
      seq(
        "transitions",
        field("field", $.identifier),
        "{",
        repeat(choice($.transition_edge, $.terminal_clause)),
        "}",
      ),

    // "from -> to"
    transition_edge: ($) =>
      seq(field("from", $.identifier), "->", field("to", $.identifier)),

    // "terminal: state1, state2"
    terminal_clause: ($) =>
      seq(
        "terminal",
        ":",
        field("states", $.identifier),
        repeat(seq(",", field("states", $.identifier))),
      ),

    // -----------------------------------------------------------------------
    // For blocks (v3)
    // -----------------------------------------------------------------------

    // Block-level for: "for binding in collection: block_item"
    // When "where" is used, it parses as a where_expression on the collection.
    for_block: ($) =>
      seq(
        "for",
        field("binding", $.identifier),
        "in",
        field("collection", $._expression),
        ":",
        field("body", $._block_item),
      ),

    // -----------------------------------------------------------------------
    // If blocks (v3)
    // -----------------------------------------------------------------------

    // Block-level if: "if condition: block_item [else if ...: ... ] [else: ...]"
    if_block: ($) =>
      prec.right(
        seq(
          "if",
          field("condition", $._expression),
          ":",
          field("consequence", $._block_item),
          repeat($.else_if_clause),
          optional($.else_clause),
        ),
      ),

    else_if_clause: ($) =>
      seq(
        "else",
        "if",
        field("condition", $._expression),
        ":",
        field("consequence", $._block_item),
      ),

    else_clause: ($) =>
      seq("else", ":", field("alternative", $._block_item)),

    // -----------------------------------------------------------------------
    // Invariant block inside entities (v3)
    // -----------------------------------------------------------------------

    // "invariant Name { expr }" inside a block body
    invariant_block: ($) =>
      seq("invariant", field("name", $.identifier), "{", field("body", $._expression), "}"),

    // -----------------------------------------------------------------------
    // Expressions
    // -----------------------------------------------------------------------

    _expression: ($) =>
      choice(
        $.for_expression,
        $.if_expression,
        $.when_expression,
        $.lambda_expression,
        $.thin_arrow_expression,
        $.implies_expression,
        $.or_expression,
        $.null_coalescing_expression,
        $.and_expression,
        $.not_expression,
        $.exists_expression,
        $.where_expression,
        $.with_expression,
        $.in_expression,
        $.not_in_expression,
        $.comparison_expression,
        $.additive_expression,
        $.multiplicative_expression,
        $.infix_predicate_expression,
        $.pipe_expression,
        $.call_expression,
        $.member_expression,
        $.optional_member_expression,
        $.string_literal,
        $.duration_literal,
        $.number_literal,
        $.boolean_literal,
        $.null_literal,
        $.backtick_literal,
        $.set_literal,
        $.identifier,
        $.block_expression,
      ),

    block_expression: ($) => $.block_body,

    tuple_expression: ($) =>
      prec.left(
        PREC.COMMA,
        seq(
          field("left", choice($._expression, $.tuple_expression)),
          ",",
          field("right", choice($._expression, $.tuple_expression)),
        ),
      ),

    // For expression: "for binding in collection: expr"
    // When "where" is used, it parses as a where_expression on the collection.
    for_expression: ($) =>
      prec.right(
        PREC.WHEN,
        seq(
          "for",
          field("binding", $.identifier),
          "in",
          field("collection", $._expression),
          ":",
          field("body", $._expression),
        ),
      ),

    // If expression: "if condition: expr [else: expr]"
    if_expression: ($) =>
      prec.right(
        PREC.WHEN,
        seq(
          "if",
          field("condition", $._expression),
          ":",
          field("consequence", $._expression),
          optional(seq("else", ":", field("alternative", $._expression))),
        ),
      ),

    // When guard: "expr when condition"
    when_expression: ($) =>
      prec.right(
        PREC.WHEN,
        seq(
          field("value", $._expression),
          "when",
          field("condition", $._expression),
        ),
      ),

    // Implies: right-associative, below or
    implies_expression: ($) =>
      prec.right(
        PREC.IMPLIES,
        seq(
          field("left", $._expression),
          "implies",
          field("right", $._expression),
        ),
      ),

    // Thin arrow: typed signatures "(value: Any) -> ByteArray"
    thin_arrow_expression: ($) =>
      prec.left(
        PREC.LAMBDA,
        seq(
          field("left", $._expression),
          "->",
          field("right", $._expression),
        ),
      ),

    // Boolean OR
    or_expression: ($) =>
      prec.left(
        PREC.OR,
        seq(
          field("left", $._expression),
          "or",
          field("right", $._expression),
        ),
      ),

    // Boolean AND
    and_expression: ($) =>
      prec.left(
        PREC.AND,
        seq(
          field("left", $._expression),
          "and",
          field("right", $._expression),
        ),
      ),

    // Unary NOT
    not_expression: ($) =>
      prec(PREC.NOT, seq("not", field("operand", $._expression))),

    // Unary EXISTS
    exists_expression: ($) =>
      prec(PREC.NOT, seq("exists", field("operand", $._expression))),

    // Where filter: "collection where condition"
    where_expression: ($) =>
      prec.left(
        PREC.WHERE,
        seq(
          field("collection", $._expression),
          "where",
          field("condition", $._expression),
        ),
      ),

    // With filter: "collection with predicate"
    with_expression: ($) =>
      prec.left(
        PREC.WHERE,
        seq(
          field("collection", $._expression),
          "with",
          field("condition", $._expression),
        ),
      ),

    // Membership: "expr in collection"
    in_expression: ($) =>
      prec.left(
        PREC.COMPARE,
        seq(
          field("element", $._expression),
          "in",
          field("collection", $._expression),
        ),
      ),

    // Negated membership: "expr not in collection"
    not_in_expression: ($) =>
      prec.left(
        PREC.COMPARE,
        seq(
          field("element", $._expression),
          "not",
          "in",
          field("collection", $._expression),
        ),
      ),

    // Comparisons: = == != < > <= >=
    comparison_expression: ($) =>
      prec.left(
        PREC.COMPARE,
        seq(
          field("left", $._expression),
          field("operator", choice("=", "==", "!=", "<", ">", "<=", ">=")),
          field("right", $._expression),
        ),
      ),

    additive_expression: ($) =>
      prec.left(
        PREC.ADD,
        seq(
          field("left", $._expression),
          field("operator", choice("+", "-")),
          field("right", $._expression),
        ),
      ),

    multiplicative_expression: ($) =>
      prec.left(
        PREC.MULTIPLY,
        seq(
          field("left", $._expression),
          field("operator", choice("*", "/")),
          field("right", $._expression),
        ),
      ),

    // Infix predicate: "expr predicate_name" — two adjacent identifiers used
    // in requires/ensures clauses like "symbol resolves_to_single_definition"
    infix_predicate_expression: ($) =>
      prec.left(
        PREC.INFIX,
        seq(
          field("subject", $._expression),
          field("predicate", $.identifier),
        ),
      ),

    // Pipe / sum-type: "a | b | c"
    pipe_expression: ($) =>
      prec.left(
        PREC.PIPE,
        seq(
          field("left", $._expression),
          "|",
          field("right", $._expression),
        ),
      ),

    // Function / method call: "Name(...)" or "a.Name(...)"
    call_expression: ($) =>
      prec(
        PREC.CALL,
        seq(
          field("function", $._expression),
          "(",
          optional(field("arguments", $.argument_list)),
          ")",
        ),
      ),

    argument_list: ($) =>
      seq(
        $._argument,
        repeat(seq(optional(","), $._argument)),
      ),

    _argument: ($) =>
      choice(
        $.named_argument,
        $._expression,
      ),

    named_argument: ($) =>
      seq(
        field("name", $.identifier),
        ":",
        field("value", $._expression),
      ),

    // Member / dot access: "a.b"
    member_expression: ($) =>
      prec(
        PREC.MEMBER,
        seq(
          field("object", $._expression),
          ".",
          field("property", $.identifier),
        ),
      ),

    // Optional member / dot access: "a?.b"
    optional_member_expression: ($) =>
      prec(
        PREC.MEMBER,
        seq(
          field("object", $._expression),
          "?.",
          field("property", $.identifier),
        ),
      ),

    // Null coalescing: "a ?? b"
    null_coalescing_expression: ($) =>
      prec.left(
        PREC.NULLISH_COALESCE,
        seq(
          field("left", $._expression),
          "??",
          field("right", $._expression),
        ),
      ),

    // Lambda: "params => body"
    lambda_expression: ($) =>
      prec.right(
        PREC.LAMBDA,
        seq(
          field("parameters", $._expression),
          "=>",
          field("body", $._expression),
        ),
      ),

    // Set literal: "{a, b, c}"
    set_literal: ($) =>
      seq(
        "{",
        $._expression,
        repeat1(seq(",", $._expression)),
        "}",
      ),
  },
});
