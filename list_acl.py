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
import sys

time.sleep(5)

endpointId = '3aca022a-5e5b-11e6-8309-22000b97daec'

tc = TransferClient() # uses transfer_token from the config file
auth = AuthClient()
match = None

if len(sys.argv)>1:
   match=sys.argv[1]

try:
   resp=tc.endpoint_acl_list(endpointId)
   if match is None:
     print(resp['DATA'])
   print("Done")
except TransferAPIError as error:
   print(error)

if match is not None:
  for s in resp['DATA']:
     path = '/%s/' % (match)
     if path in s['path']:
        rule = tc.get_endpoint_acl_rule(endpointId, s['id'])
        for k in s.keys():
           print("%-20s: %-40s" % (k, s[k]))
#  try:
#     resp=tc.endpoint_acl_list(endpointId)
#     print(resp)
#     print("Done")
#  except TransferAPIError as error:
#     print(error)
