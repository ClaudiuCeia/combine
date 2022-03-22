service <<name>> {
    match <<path>> {
        allow <<methods>> : if <<condition>>
    }
}

service neptune {
    match kprn:kopplr:company:{uuid} {
        allow read, write : if isRep() || isCreator() || request.user.tenant == ADMIN
        allow read : if isProvider()
    }
}

--- AST Node

{
  kind: ...,
  loc: {...},
  (custom)
}