"""Provision NEW staging secrets without printing them. Requires authenticated Supabase CLI.
Never activates account linking; never sends SMS; do not use for rotation.
"""
import argparse, getpass, json, os, secrets, subprocess, tempfile
from urllib.parse import urlparse
PARENTS=('ljcxqwjvjgobhisqkujr','rfayqekonkovfbkwjjum')
def cli(*args):
    r=subprocess.run(['supabase',*args],capture_output=True,text=True)
    if r.returncode: raise RuntimeError('Supabase command failed; inspect the Dashboard. Output withheld to protect secrets.')
    return r.stdout
def branch(parent,ref):
    data=json.loads(cli('branches','list','--project-ref',parent,'--output','json'))
    if isinstance(data,dict): data=data.get('branches',[])
    if not any(x.get('project_ref')==ref and not x.get('is_default') and x.get('status')=='FUNCTIONS_DEPLOYED' for x in data):
        raise ValueError('Target must be a healthy non-default branch of the expected project.')
def write_secret_file(path,values):
    if any('\n' in v or '\r' in v or '"' in v or '\\' in v for v in values.values()):
        raise ValueError('Invalid environment value')
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f:
        for k,v in values.items(): f.write(k+'="'+v+'"\n')
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--afroloc-ref',required=True);parser.add_argument('--yamilook-ref',required=True)
    parser.add_argument('--consent-url',required=True);parser.add_argument('--infobip-base-url',required=True);parser.add_argument('--sender',required=True)
    args=parser.parse_args()
    refs=[args.afroloc_ref,args.yamilook_ref]
    if len(set(refs))!=2 or any(x in PARENTS for x in refs): raise ValueError('Production targets are forbidden')
    for parent,ref in zip(PARENTS,refs): branch(parent,ref)
    consent=urlparse(args.consent_url);sms=urlparse(args.infobip_base_url)
    if consent.scheme!='https' or consent.path!='/account-link' or consent.query or consent.fragment or consent.username: raise ValueError('Invalid staging consent URL')
    if sms.scheme!='https' or not (sms.hostname or '').endswith('.api.infobip.com') or sms.username or sms.query or sms.fragment or sms.path not in ('','/'): raise ValueError('Invalid Infobip URL')
    # Refuse accidental rotation: inspect names only, never export secret values.
    for ref in refs:
        existing=json.loads(cli('secrets','list','--project-ref',ref,'--output','json'))
        if not isinstance(existing,list): raise ValueError('Unexpected secret listing format')
        if any(x.get('name') in ('ACCOUNT_LINK_PARTNER_KEY','ACCOUNT_PHONE_OTP_PEPPER') for x in existing): raise ValueError('Existing linking secrets: use a separately reviewed rotation plan')
    key=getpass.getpass('Restricted Infobip test API key (hidden): ')
    if not key or not args.sender: raise ValueError('SMS key and sender are required')
    shared=secrets.token_hex(32)
    with tempfile.TemporaryDirectory(prefix='account-link-secrets-') as d:
        for i,ref in enumerate(refs):
            values={'ACCOUNT_LINK_V1_ENABLED':'false','ACCOUNT_LINK_PARTNER_KEY':shared,'ACCOUNT_PHONE_OTP_PEPPER':secrets.token_hex(32),'INFOBIP_API_KEY':key,'INFOBIP_BASE_URL':args.infobip_base_url,'INFOBIP_SENDER':args.sender}
            if i: values.update(AFROLOC_LINK_ENDPOINT='https://'+refs[0]+'.supabase.co/functions/v1/account-link-authority',AFROLOC_CONSENT_URL=args.consent_url)
            path=os.path.join(d,str(i)+'.env');write_secret_file(path,values)
            cli('secrets','set','--project-ref',ref,'--env-file',path)
    print('Staging secrets installed. Linking remains disabled. No SMS was sent.')
if __name__=='__main__':
    try: main()
    except Exception as e: raise SystemExit(str(e))
