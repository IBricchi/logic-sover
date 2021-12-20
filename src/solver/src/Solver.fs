module Solver

open Lexer
open Parser
open Propositional

let gen_interpretation input =
    let tokens = tokenize (Seq.toList input)
    let ast = parse tokens
    node_print ast

let gen_text_tree input =
    let tokens = tokenize (Seq.toList input)
    let ast = parse tokens
    let proof_tree = propopositional_solver ast
    print_tree proof_tree

let gen_tree input =
    let tokens = tokenize (Seq.toList input)
    let ast = parse tokens
    let proof_tree = propopositional_solver ast
    json_from_tree proof_tree
