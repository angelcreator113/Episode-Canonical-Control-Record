import json
import boto3
import urllib.parse

s3 = boto3.client('s3')
opensearch = boto3.client('opensearchserverless')

def lambda_handler(event, context):
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'])
    
    try:
        # Get object metadata
        response = s3.head_object(Bucket=bucket, Key=key)
        
        # Log to CloudWatch
        print(f'Processing {key} from {bucket}')
        print(f'Size: {res  }
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Thumbnail processed successfully',
                'bucket': bucket,
                'key': key
            })
        }
    except Exception as e:
        print(f'Error: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
