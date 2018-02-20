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

if not os.path.exists(args.sharedDir):
    os.makedirs(args.sharedDir)
    os.chmod(args.sharedDir, 0777)

authToken = ''
transferToken = ''
endpointId = ''

tc = TransferClient(authorizer=transferToken) # uses transfer_token from the config file
auth = AuthClient(authorizer=authToken)

identities = auth.get_identities(usernames="%s@globusid.org" % args.shareName)
user_identity_id = identities['identities'][0]['id']
try:
   tc.add_endpoint_acl_rule(
       endpointId,
       dict(principal=user_identity_id,
            principal_type='identity', path=args.sharedDir, permissions='rw'),
   )
except TransferAPIError as error:
   if error.code != 'Exists':
       raise
