module Propositional

open Helper
open Lexer
open Parser

type ProofLine =
    | PropositionLine of int * Node
    | NegElimLine of int * ProofLine * Node
    | AlphaLine of int * ProofLine * Node
    | BetaLine of int * ProofLine * ProofLine * Node
    | EtaLine of int * ProofLine * ProofLine * Node
    | OpenLine of int
    | CloseLine of int * ProofLine * ProofLine
    | BranchLine of int * Node

type ProofTree =
    | End of ProofLine
    | Continuous of ProofLine * ProofTree
    | Branch of ProofTree * ProofTree

type ProofBranchLine =
    | Root
    | Line of ProofLine * ProofBranchLine

////////////////////////////////
/// Helper Display Functions ///
////////////////////////////////

let get_line line =
    match line with
    | PropositionLine (ln, _) -> ln
    | NegElimLine (ln, _, _) -> ln
    | AlphaLine (ln, _, _) -> ln
    | BetaLine (ln, _, _, _) -> ln
    | EtaLine (ln, _, _, _) -> ln
    | OpenLine (ln) -> ln
    | CloseLine (ln, _, _) -> ln
    | BranchLine (ln, _) -> ln

let rec print_format_line tab formula =
    match tab with
    | 0 ->
        match formula with
        | PropositionLine(ln, node) ->
            sprintf "%d: <P>: %s\n" ln (node_print node)
        | NegElimLine(ln, src, node) ->
            let src_ln = get_line src
            sprintf "%d: <DNE %d>: %s\n" ln src_ln (node_print node)
        | AlphaLine(ln, src, node) ->
            let src_ln = get_line src
            sprintf "%d: <A %d>: %s\n" ln src_ln (node_print node)
        | BetaLine(ln, beta_max, beta_min, node) ->
            let bmax_ln = get_line beta_max
            let bmin_ln = get_line beta_min
            sprintf "%d: <B %d %d>: %s\n" ln bmax_ln bmin_ln (node_print node)
        | EtaLine(ln, eta_max, eta_min, node) ->
            let emax_ln = get_line eta_max
            let emin_ln = get_line eta_min
            sprintf "%d: <E %d %d>: %s\n" ln emax_ln emin_ln (node_print node)
        | OpenLine(ln) ->
            sprintf "%d: <O>\n\n" ln
        | CloseLine(ln, close_max, close_min) ->
            let cmax_ln = get_line close_max
            let cmin_ln = get_line close_min
            sprintf "%d: <C %d %d>\n\n" ln cmax_ln cmin_ln
        | BranchLine(ln, node) ->
            sprintf "%d: <B>: %s\n" ln (node_print node)
    | tab ->
        sprintf " %s" (print_format_line (tab-1) formula)

let rec print_format_tree tab tree =
    match tree with
    | End (line) -> print_format_line tab line
    | Continuous (line, tree) ->
        sprintf "%s%s" (print_format_line tab line) (print_format_tree tab tree)
    | Branch (left, right) ->
        sprintf "%s%s" (print_format_tree (tab+1) left) (print_format_tree (tab+1) right)

let print_tree tree =
    print_format_tree 0 tree

let json_from_tree_line formula =
    match formula with
    | PropositionLine(ln, node) ->
        sprintf "{type: \"p\", ln: %d, formula: \"%s\"}" ln (node_print node)
    | NegElimLine(ln, src, node) ->
        let src_ln = get_line src
        sprintf "{type: \"ne\", ln: %d, src: %d, formula: \"%s\"}" ln src_ln (node_print node)
    | AlphaLine(ln, src, node) ->
        let src_ln = get_line src
        sprintf "{type: \"a\", ln: %d, src: %d, formula: \"%s\"}" ln src_ln (node_print node)
    | BetaLine(ln, beta_max, beta_min, node) ->
        let bmax_ln = get_line beta_max
        let bmin_ln = get_line beta_min
        sprintf "{type: \"b\", ln: %d, src: %d, min_src: %d, formula: \"%s\"}" ln bmax_ln bmin_ln (node_print node)
    | EtaLine(ln, eta_max, eta_min, node) ->
        let emax_ln = get_line eta_max
        let emin_ln = get_line eta_min
        sprintf "{type: \"e\", ln: %d, src: %d, min_src: %d, formula: \"%s\"}" ln emax_ln emin_ln (node_print node)
    | OpenLine(ln) ->
        sprintf "{type: \"o\", ln: %d}" ln
    | CloseLine(ln, close_max, close_min) ->
        let cmax_ln = get_line close_max
        let cmin_ln = get_line close_min
        sprintf "{type: \"c\", ln: %d, src: %d, min_src: %d}" ln cmax_ln cmin_ln
    | BranchLine(ln, node) ->
        sprintf "{type: \"b\", ln: %d, formula: \"%s\"}" ln (node_print node)

let rec json_from_tree_helper tree =
    match tree with
    | End (line) -> json_from_tree_line line
    | Continuous(line, tree) -> sprintf "%s, %s" (json_from_tree_line line) (json_from_tree_helper tree)
    | Branch(left, right) -> sprintf "{type: \"bc\", left: [%s], right: [%s]}" (json_from_tree_helper left) (json_from_tree_helper right)

let json_from_tree tree = 
    "[" + json_from_tree_helper tree + "]"

//////////////////////
/// Main Functions ///
//////////////////////

let rec remove_neg node =
    match node with
    | UnaryNode(NOT, UnaryNode(NOT, operand)) -> remove_neg operand
    | _ -> node

let negate node =
    remove_neg (UnaryNode (NOT, node))

let rec in_branch node line =
    match line with
    | Root -> None
    | Line (PropositionLine (ln, l_node), _) when l_node = node -> Some(PropositionLine (ln, l_node))
    | Line (NegElimLine (ln, a, l_node), _) when l_node = node -> Some(NegElimLine(ln, a, l_node))
    | Line (AlphaLine (ln,a,l_node), _) when l_node = node -> Some(AlphaLine (ln,a,l_node))
    | Line (BetaLine (ln,a,b,l_node), _) when l_node = node -> Some(BetaLine (ln,a,b,l_node))
    | Line (EtaLine (ln,a,b,l_node), _) when l_node = node -> Some(EtaLine (ln,a,b,l_node))
    | Line (BranchLine (ln,l_node), _) when l_node = node -> Some(BranchLine (ln,l_node))
    | Line (_, prev) -> in_branch node prev

let neg_in_branch node line =
    in_branch (negate node) line

let rec prop_helper ln nodes passed tree =
    // printfn "------------------------------"
    // printfn "ln: %d" ln
    // printfn "nodes: %A" nodes
    // printfn "passed: %A" passed
    // printfn "tree: %A" tree
    // printfn "------------------------------"
    let prev = match tree with
                | Root -> None 
                | Line (line, _) -> Some(line)
    
    match nodes with
    | [] -> 
        match passed with
        | [] -> End (OpenLine ln)
        | node::_ ->
            match node with
            | BinaryNode(_, left, _) ->
                let true_branch_line = BranchLine(ln, left)
                let true_down_tree = Line(true_branch_line, tree)
                let true_up_tree = prop_helper (ln+1) passed [] true_down_tree
                let true_branch_tree = Continuous(true_branch_line, true_up_tree)

                let false_branch_line = BranchLine(ln, negate left)
                let false_down_tree = Line(false_branch_line, tree)
                let false_up_tree = prop_helper (ln+1) passed [] false_down_tree
                let false_branch_tree = Continuous(false_branch_line, false_up_tree)

                Branch(true_branch_tree, false_branch_tree)
            | _ -> failwith "This should be unreachable"
    | node::nodes ->
        match neg_in_branch node tree with
        | Some(line) ->
            match prev with
            | None -> failwith "This should be unreachable."
            | Some (prev) -> End (CloseLine (ln, line, prev))
        | None -> 
            match node with
            | BinaryNode(op, left, right) ->
                match op with
                | COMMA ->
                    let instr_line = PropositionLine (ln, left)
                    let down_tree = Line (instr_line, tree)
                    match right with
                    | BinaryNode(op, _, _) when op = COMMA ->
                        let next_up_tree = prop_helper (ln+1) (nodes @ [right]) (left::passed) down_tree
                        Continuous (instr_line, next_up_tree)
                    | _ ->
                        let next_instr_line = PropositionLine (ln+1, right)
                        let next_down_tree = Line (next_instr_line, down_tree)
                        let up_tree = prop_helper (ln+2) ((rev passed) @ left::[right]) [] next_down_tree
                        Continuous (instr_line, Continuous (next_instr_line, up_tree))
                | AND -> alpha_helper ln nodes passed tree node left right
                | OR -> beta_helper ln nodes passed tree node left right
                | IMP -> beta_helper ln nodes passed tree node (negate left) right
                | BIMP -> eta_helper ln nodes passed tree node left right
                | _ -> prop_helper ln nodes passed tree
            | UnaryNode(op, operand) -> 
                match op with
                | NOT ->
                    match operand with
                    | BinaryNode(op, left, right) ->
                        match op with
                        | COMMA -> failwith "This should be unreachable."
                        | AND -> beta_helper ln nodes passed tree node (negate left) (negate right)
                        | OR -> alpha_helper ln nodes passed tree node (negate left) (negate right)
                        | IMP -> alpha_helper ln nodes passed tree node left (negate right)
                        | BIMP -> eta_helper ln nodes passed tree node left (negate right)
                        | _ -> failwith "This should be unreachable."
                    | UnaryNode(op, operand) ->
                        match op with
                        | NOT ->
                            let new_node = remove_neg operand
                            let prev_instr_line = match in_branch node tree with
                                                    | None -> failwith "This should be unreachable."
                                                    | Some (prev) -> prev
                            let instr = NegElimLine(ln, prev_instr_line, new_node)
                            let down_tree = Line(instr, tree)
                            let up_tree = prop_helper (ln+1) (new_node::nodes) passed down_tree
                            Continuous (instr, up_tree)
                        | _ -> failwith "This should be unreachable"
                    | AtomNode(_) -> prop_helper ln nodes passed tree
                | _ -> failwith "This should be unreachable."
            | AtomNode(_) -> prop_helper ln nodes passed tree

and alpha_helper ln nodes passed tree node left right =
    let prev_instr_line = match in_branch node tree with
                            | None -> failwith "This should be unreachable."
                            | Some (prev) -> prev
    let left_instr = AlphaLine (ln, prev_instr_line, left)
    let right_instr = AlphaLine (ln+1, prev_instr_line, right)
    let down_tree = Line(left_instr, Line(right_instr, tree))
    let up_tree = prop_helper (ln+2) (left::right::nodes@passed) [] down_tree
    Continuous (left_instr, Continuous (right_instr, up_tree))

and beta_helper ln nodes passed tree node left right = 
    let prev_instr_line = match in_branch node tree with
                            | None -> failwith "This should be unreachable."
                            | Some (prev) -> prev
    match in_branch left tree with
    | Some(_) -> // Beta Reduction due to left
        prop_helper ln nodes passed tree
    | None ->
        match in_branch right tree with
        | Some(_) -> // Beta reduction due to right
            prop_helper ln nodes passed tree
        | None ->
            match neg_in_branch left tree with
            | Some(left_line) -> // Beta expansion due to left
                let right_instr_line = BetaLine (ln, prev_instr_line, left_line, right)
                let down_tree = Line(right_instr_line, tree)
                let up_tree = prop_helper (ln+1) (right::nodes) passed down_tree
                Continuous (right_instr_line, up_tree)
            | None ->
                match neg_in_branch right tree with
                | Some(right_line) -> // Beta expansion due to right
                    let left_instr_line = BetaLine (ln, prev_instr_line, right_line, left)
                    let down_tree = Line(left_instr_line, tree)
                    let up_tree = prop_helper (ln+1) (left::nodes) passed down_tree
                    Continuous (left_instr_line, up_tree)
                | None -> // Ignore and move to passed
                    prop_helper ln nodes (node::passed) tree
and eta_helper ln nodes passed tree node left right =
    let prev_instr_line = match in_branch node tree with
                            | None -> failwith "This should be unreachable."
                            | Some (prev) -> prev
    match in_branch left tree with
    | Some(left_line) -> // left true
        let left_instr_line = EtaLine(ln, prev_instr_line, left_line, right)
        let down_tree = Line(left_instr_line, tree)
        let up_tree = prop_helper (ln+1) (right::nodes @ passed) [] down_tree
        Continuous (left_instr_line, up_tree)
    | None ->
        match neg_in_branch left tree with
        | Some(neg_left_line) -> // left false
            let neg_right = negate right
            let neg_left_instr_line = EtaLine(ln, prev_instr_line, neg_left_line, neg_right)
            let down_tree = Line(neg_left_instr_line, tree)
            let up_tree = prop_helper (ln+1) (neg_right::nodes @ passed) [] down_tree
            Continuous (neg_left_instr_line, up_tree)
        | None ->
            match in_branch right tree with
            | Some(right_line) -> // right true
                let right_instr_line = EtaLine(ln, prev_instr_line, right_line, left)
                let down_tree = Line(right_instr_line, tree)
                let up_tree = prop_helper (ln+1) (left::nodes @ passed) [] down_tree
                Continuous (right_instr_line, up_tree)
            | None ->
                match neg_in_branch right tree with
                | Some(neg_right_line) -> // right false
                    let neg_left = negate left
                    let neg_right_instr_line = EtaLine(ln, prev_instr_line, neg_right_line, neg_left)
                    let down_tree = Line(neg_right_instr_line, tree)
                    let up_tree = prop_helper (ln+1) (neg_left::nodes @ passed) [] down_tree
                    Continuous (neg_right_instr_line, up_tree)
                | None -> // Ignore and move to passed
                    prop_helper ln nodes (node::passed) tree


let propopositional_solver node =
    match node with
    | BinaryNode(op, left, right) when op = COMMA -> 
        prop_helper 0 [node] [] Root
    | _ ->
        let up_tree = prop_helper 1 [node] [] (Line (PropositionLine (0, node), Root))
        Continuous (PropositionLine (0, node), up_tree)
