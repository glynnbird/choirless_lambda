"""
status.py

Uses the Choirless API to record the progress of a render by calling POST /postRender

"""

import os
from urllib.parse import urljoin
import requests


def main(args):
    '''Posts a render status log via the Choirless API'''

    # Tell the API the current render sttus
    try:
        # get passed-in arguments
        api_url = os.environ['CHOIRLESS_API_URL']
        choir_id = args.get('choir_id')
        song_id = args.get('song_id')
        part_id = args.get('part_id', None)
        status = args.get('status', 'new')

        # pass everything else in the POST body
        payload = {
            'choirId': choir_id,
            'songId': song_id,
            'partId': part_id,
            'status': status
        }
        print(payload)
        # make HTTP POST request with application/json header
        requests.post(urljoin(api_url, 'postRender'), json=payload)
        return {'status': 'ok'}

    except requests.exceptions.RequestException as e:
        print(e)
        print(f"Could not post render status into the API: "
              f"choirId {choir_id} songId {song_id} partId {part_id} status {status}")
        return {'status': 'error'}
