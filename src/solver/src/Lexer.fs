module Lexer

type Token = 
    | L_BRACK
    | R_BRACK
    | IDENT of string
    | COMMA
    | OR
    | AND
    | NOT
    | IMP
    | BIMP

let format_token token =
    match token with
    | L_BRACK -> "("
    | R_BRACK -> ")"
    | IDENT(v) -> v
    | COMMA -> ","
    | OR -> "∪" //"\u2228"
    | AND -> "∩" //"\u2227"
    | NOT -> "¬"
    | IMP -> "→"
    | BIMP -> "↔"

type TokenAssoc =
    | LEFT
    | RIGHT
    | NA

type TokenArity =
    | UNARY
    | BINARY
    | NA

type TokenData =
    TokenData of TokenAssoc * int * TokenArity

let token_data token_type =
    match token_type with
    | L_BRACK -> TokenData(TokenAssoc.NA, -1, TokenArity.NA)
    | R_BRACK -> TokenData(TokenAssoc.NA, -1, TokenArity.NA)
    | IDENT(_) -> TokenData(TokenAssoc.NA, -1, TokenArity.NA)
    | COMMA -> TokenData(RIGHT, 1, BINARY)
    | OR -> TokenData(LEFT, 2, BINARY)
    | AND -> TokenData(LEFT, 3, BINARY)
    | NOT -> TokenData(RIGHT, 6, UNARY)
    | IMP -> TokenData(LEFT, 4, BINARY)
    | BIMP -> TokenData(LEFT, 5, BINARY)

let token_assoc token_type =
    match token_data token_type with
    | TokenData (assoc,_,_) -> assoc

let token_prec token_type =
    match token_data token_type with
    | TokenData (_, prec, _) -> prec

let token_arity token_type =
    match token_data token_type with
    | TokenData (_, _, arity) -> arity

let rec tokenize char_stream = 
    match char_stream with
    | [] -> []
    | h::t -> 
        match h with 
        | ' ' -> tokenize t
        | '\n' -> tokenize t
        | '\t' -> tokenize t
        | '\r' -> tokenize t
        | '(' -> L_BRACK::tokenize t
        | ')' -> R_BRACK::tokenize t
        | c when c <= 'z' && c >= 'a' -> IDENT(c.ToString())::tokenize t
        | ',' -> COMMA::tokenize t
        | '|' -> OR::tokenize t
        | '&' -> AND::tokenize t
        | '-' -> 
            match t with
            | h::t ->
                match h with
                | '>' -> IMP::tokenize t
                | _ -> failwith (sprintf "unexpected character %c" h)
            | _ -> failwith (sprintf "unexpected character %c" h)
        | '<' ->
            match t with
            | h::t ->
                match h with
                | '-' -> 
                    match t with
                    | h::t ->
                        match h with
                        | '>' -> BIMP::tokenize t
                        | _ -> failwith (sprintf "unexpected character %c" h)
                    | _ -> failwith (sprintf "unexpected character %c" h)
                | _ -> failwith (sprintf "unexpected character %c" h)
            | _ -> failwith (sprintf "unexpected character %c" h)
        | '~' -> NOT::tokenize t
        | _ -> failwith (sprintf "unexpected character %c" h)