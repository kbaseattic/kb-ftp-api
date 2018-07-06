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

parser = argparse.ArgumentParser(description='remove share from kbase endpoint')
parser.add_argument('--share-id', dest='shareId',
                help='Id of share to remove', required=True)

args = parser.parse_args()
print(args.shareId)

endpointId = '3aca022a-5e5b-11e6-8309-22000b97daec'

tc = TransferClient() # uses transfer_token from the config file
auth = AuthClient()

try:
   #resp=tc.delete_endpoint_acl_rule(
   resp=tc.delete_endpoint_acl_rule( endpointId, args.shareId ) 
   with open('/var/log/globus_shares.log','a') as f:
       f.write('Deleted share ID %s' %(args.shareId))
   print("Done")
except TransferAPIError as error:
   print(error)
