module Parser
open Lexer

type Node =
    UnaryNode of Token * Node
    | BinaryNode of Token * Node * Node
    | AtomNode of Token

let rec parse_helper (stack: Node list, op_stack) (token_stream: Token list) =
    // printfn "----------------------------------------"
    // printfn "stack: %A" stack
    // printfn "op_stack: %A" op_stack
    // printfn "token_stream: %A" token_stream
    // printfn "----------------------------------------"
    match token_stream with
    | [] -> 
        match op_stack with
        | [] -> stack.Head
        | op::t ->
            match token_arity op with 
                | UNARY ->
                    let operand = stack.Head
                    parse_helper (UnaryNode(op, operand)::stack.Tail, t) []
                | BINARY ->
                    let right = stack.Head
                    let left = stack.Tail.Head
                    parse_helper (BinaryNode(op, left, right)::stack.Tail.Tail, t) []
                | NA -> failwith "unexpected token"
    | op::t ->
        match op with
        | IDENT(v) -> parse_helper (AtomNode(op)::stack, op_stack) t
        | L_BRACK -> parse_helper (stack, op::op_stack) t
        | R_BRACK ->
            match op_stack with
            | [] -> failwith "unexpected )"
            | op_op::op_t when token_arity op_op = UNARY -> 
                let operand = stack.Head
                parse_helper (UnaryNode(op_op, operand)::stack.Tail, op_t) (op::t)
            | op_op::op_t when token_arity op_op = BINARY->
                let right = stack.Head
                let left = stack.Tail.Head
                parse_helper (BinaryNode(op_op, left, right)::stack.Tail.Tail, op_t) (op::t)
            | L_BRACK::op_t -> parse_helper (stack, op_t) t
            | _ -> failwith "unexpected )"
        | _ ->
            match token_assoc op with
                LEFT ->
                    match op_stack with
                        | op_op::op_t when token_prec op <= token_prec op_op ->
                            match token_arity op_op with
                            | UNARY ->
                                let operand = stack.Head
                                parse_helper (UnaryNode(op_op, operand)::stack.Tail, op_t) (op::t)
                            | BINARY ->
                                let right = stack.Head
                                let left = stack.Tail.Head
                                parse_helper (BinaryNode(op_op, left, right)::stack.Tail.Tail, op_t) (op::t)
                            | NA -> failwith "unexpected token"
                        | L_BRACK::_ | [] -> parse_helper (stack, op::op_stack) t
                        | op_op::op_t when token_prec op > token_prec op_op ->
                            parse_helper (stack, (op::op_stack)) t
                        | _ -> failwith "unexpected operator"
                | RIGHT ->
                    match op_stack with
                        | op_op::op_t when token_prec op < token_prec op_op ->
                            match token_arity op_op with
                            | UNARY ->
                                let operand = stack.Head
                                parse_helper (UnaryNode(op_op, operand)::stack.Tail, op_t) (op::t)
                            | BINARY ->
                                let right = stack.Head
                                let left = stack.Tail.Head
                                parse_helper (BinaryNode(op_op, left, right)::stack.Tail.Tail, op_t) (op::t)
                            | _ -> failwith "unexpected token"
                        | L_BRACK::_ | [] -> parse_helper (stack, op::op_stack) t
                        | op_op::op_t when token_prec op >= token_prec op_op ->
                            parse_helper (stack, op::op_stack) t
                        | _ -> failwith "unexpected operator"
                | _ -> failwith "unexpected operator"

let rec parse (token_stream: Token list) = parse_helper ([], []) token_stream


////////////////////////
/// Helper functions ///
////////////////////////

let node_prec node =
    let op = match node with
                | UnaryNode(op, _) -> op
                | BinaryNode(op, _, _) -> op
                | AtomNode(op) -> op
    token_prec op

let node_assoc node =
    let op = match node with
                | UnaryNode(op, _) -> op
                | BinaryNode(op, _, _) -> op
                | AtomNode(op) -> op
    token_assoc op

let rec node_print node =
    let prec = node_prec node
    match node with
    | UnaryNode(op, operand) when let op_prec = node_prec operand in prec > op_prec && op_prec > 0 ->
        sprintf "%s(%s)" (format_token op) (node_print operand)
    | UnaryNode(op, operand) ->
        sprintf "%s%s" (format_token op) (node_print operand)
    | BinaryNode(op, left, right) ->
        let ls = match let op_prec = node_prec left in (prec > op_prec && op_prec > 0) || (prec = op_prec && node_assoc left = RIGHT) with
                    | true ->
                        sprintf "(%s)" (node_print left)
                    | false ->
                        node_print left
        let rs = match let op_prec = node_prec right in (prec > op_prec && op_prec > 0) || (prec = op_prec && node_assoc right = LEFT) with
                    | true ->
                        sprintf "(%s)" (node_print right)
                    | false ->
                        node_print right
        sprintf "%s%s%s" ls (format_token op) rs
    | AtomNode(op) ->
        sprintf "%s" (format_token op)
    | _ -> failwith "This should be unreachable."
