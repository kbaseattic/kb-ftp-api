#!/usr/bin/env python2.7
from __future__ import print_function # for python 2
from globus_sdk import TransferClient
from globus_sdk import AuthClient
from globus_sdk import TransferAPIError
import globus_sdk
import traceback
import argparse
import os
import time

time.sleep(5)

parser = argparse.ArgumentParser(description='kbase share creator')
parser.add_argument('--share-dir', dest='sharedDir',
                help='Directory to create a share on', required=True)
parser.add_argument('--share-name', dest='shareName', 
                help='globusid to share with', required=True)

args = parser.parse_args()
print(args.sharedDir)
print(args.shareName)

#if not os.path.exists(args.sharedDir):
#    os.makedirs(args.sharedDir)
#    os.chmod(args.sharedDir, 0777)

endpointId = '3aca022a-5e5b-11e6-8309-22000b97daec'

tc = TransferClient() # uses transfer_token from the config file
auth = AuthClient()
with open('/data/bulk/%s/.globus_id'%(args.shareName),'r') as f:
    ident=f.read()

print(ident)

identities= ident.split('\n')

#identities = auth.get_identities(usernames="%s@globusid.org" % args.shareName)
identities = auth.get_identities(usernames=ident.split('\n')[0])
print(identities)
user_identity_id = identities['identities'][0]['id']
print (user_identity_id)
#sys.exit()
try:
   #resp=tc.update_endpoint_acl_rule(
   resp=tc.add_endpoint_acl_rule(
       endpointId,
       dict(DATA_TYPE="access", principal=user_identity_id,
            principal_type='identity', path=args.sharedDir, permissions='rw'),
   )
   with open('/var/log/globus_shares.log','a') as f:
       f.write('Shared %s with %s\n' %(args.sharedDir,args.shareName))
   print("Done")
except TransferAPIError as error:
   print(error)
   if error.code != 'Exists':
       raise
