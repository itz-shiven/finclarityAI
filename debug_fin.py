
import re

def requires_database_lookup(text):
    text_lower = (text or "").lower().strip()
    patterns = [
        r"\bcompare\b", r"\bvs\b", r"\bcredit card\b", r"\bloan\b", r"\binterest rate\b",
        r"\bprocessing fee\b", r"\bannual fee\b", r"\bjoining fee\b", r"\bforex markup\b",
        r"\beligibility\b", r"\blounge access\b", r"\breward rate\b", r"\bbrokerage\b",
        r"\bamc\b", r"\bfeatures of\b", r"\bdetails of\b", r"\bhdfc\b", r"\bsbi\b",
        r"\baxis\b", r"\bicici\b", r"\bkotak\b", r"\bamex\b", r"\bindusind\b",
        r"\byes bank\b", r"\bbajaj\b"
    ]
    for p in patterns:
        if re.search(p, text_lower):
            return True, p
    return False, None

def is_financial_query(text):
    text_lower = (text or "").lower().strip()
    fin_patterns = [
        r"\bmoney\b", r"\bcash\b", r"\bsave\b", r"\bsaving\b", r"\binvest\b", r"\binvestment\b",
        r"\bsalary\b", r"\bincome\b", r"\btax\b", r"\bbudget\b", r"\bexpense\b", r"\bspend\b",
        r"\bwallet\b", r"\bbank\b", r"\binterest\b", r"\bfinance\b", r"\bfinancial\b",
        r"\bloan\b", r"\bcard\b", r"\bstock\b", r"\bmarket\b", r"\bgold\b", r"\bfund\b",
        r"\bsip\b", r"\binsurance\b", r"\bpension\b", r"\bpf\b", r"\bgst\b", r"\bdebt\b",
        r"\bcredit\b", r"\bdebit\b", r"\bscore\b", r"\bcibil\b", r"\bpan\b", r"\baadhar\b",
        r"\bkyc\b", r"\bupi\b", r"\bpayment\b", r"\btransfer\b", r"\bremittance\b",
        r"\bipo\b", r"\bdividend\b", r"\byield\b", r"\breturns\b", r"\binflation\b",
        r"\beconomy\b", r"\btrading\b", r"\bbroker\b", r"\bequity\b", r"\bfd\b", r"\brd\b",
        r"\bportfolio\b", r"\bcrypto\b", r"\bbitcoin\b"
    ]
    
    db_lookup, path = requires_database_lookup(text)
    if db_lookup:
        return True, f"db_lookup ({path})"
        
    for p in fin_patterns:
        if re.search(p, text_lower):
            return True, p
    return False, None

query = "how to go to chandigarh?"
res, pattern = is_financial_query(query)
print(f"Query: '{query}'")
print(f"Result: {res}")
print(f"Matched pattern: {pattern}")
