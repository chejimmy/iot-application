import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import {
  Distribution,
  HeadersFrameOption,
  OriginAccessIdentity,
  ResponseHeadersPolicy,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Effect, PolicyStatement, StarPrincipal } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { randomUUID } from 'crypto';
import path from 'path';
import { getPublicAssetCsp } from '../csp/public-asset-directives';

const CLIENT_BUILD_DIR_PATH = '../../../apps/client/build';

export interface PublicAssetStackProps extends StackProps {
  readonly coreServiceUrl: string;
  readonly identityPoolId: string;
  readonly userPoolClientId: string;
  readonly userPoolId: string;
}

export class PublicAssetStack extends Stack {
  readonly publicDistribution: Distribution;

  constructor(scope: Construct, id: string, props: PublicAssetStackProps) {
    super(scope, id, props);

    const { identityPoolId, userPoolClientId, userPoolId, coreServiceUrl } =
      props;

    const assetHashKey = randomUUID();

    const assetBucket = new Bucket(this, 'AssetBucket', {
      lifecycleRules: [
        {
          noncurrentVersionExpiration: Duration.days(90),
        },
      ],
      versioned: true,
    });

    // Configure S3 bucket policy to allow only TLS requests
    assetBucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ['s3:*'],
        conditions: {
          Bool: {
            'aws:SecureTransport': false,
          },
        },
        effect: Effect.DENY,
        principals: [new StarPrincipal()],
        resources: [assetBucket.bucketArn, assetBucket.arnForObjects('*')],
      }),
    );

    const assetBucketOAI = new OriginAccessIdentity(this, 'AssetBucketOAI');
    assetBucket.grantRead(assetBucketOAI);

    const clientAssetDeployment = new BucketDeployment(
      this,
      'ClientAssetDeployment',
      {
        destinationBucket: assetBucket,
        destinationKeyPrefix: assetHashKey,
        exclude: ['aws-resources.js'],
        memoryLimit: 200,
        prune: false,
        sources: [Source.asset(path.join(__dirname, CLIENT_BUILD_DIR_PATH))],
      },
    );

    const awsResources = {
      amplifyConfiguration: {
        Auth: {
          region: this.region,
          identityPoolId,
          userPoolId,
          userPoolWebClientId: userPoolClientId,
        },
      },
      coreServer: {
        endpoint: coreServiceUrl,
      },
    };

    const awsResourcesFile = new AwsCustomResource(this, 'AwsResourcesFile', {
      onUpdate: {
        service: 'S3',
        action: 'putObject',
        parameters: {
          Body: `window.awsResources=${this.toJsonString(awsResources)};`,
          Bucket: assetBucket.bucketName,
          Key: `${assetHashKey}/aws-resources.js`,
          ContentType: 'application/javascript',
        },
        // Update physical id to always overwrite
        physicalResourceId: PhysicalResourceId.of(Date.now().toString()),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: [`${assetBucket.bucketArn}/*/aws-resources.js`],
      }),
    });

    const publicAssetHeaders = new ResponseHeadersPolicy(
      this,
      'PublicAssetHeaders',
      {
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy: getPublicAssetCsp(
              coreServiceUrl,
              this.region,
            ),
            override: true,
          },
          contentTypeOptions: {
            override: true,
          },
          frameOptions: {
            frameOption: HeadersFrameOption.DENY,
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: Duration.seconds(47304000),
            includeSubdomains: true,
            override: true,
          },
        },
        customHeadersBehavior: {
          customHeaders: [
            {
              header: 'Cache-Control',
              override: true,
              value: 'no-store',
            },
          ],
        },
      },
    );

    this.publicDistribution = new Distribution(
      this,
      'PublicAssetDistribution',
      {
        defaultBehavior: {
          responseHeadersPolicy: publicAssetHeaders,
          origin: new S3Origin(assetBucket, {
            originAccessIdentity: assetBucketOAI,
            originPath: assetHashKey,
          }),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        defaultRootObject: 'index.html',
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
          },
        ],
        minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      },
    );
    this.publicDistribution.node.addDependency(
      clientAssetDeployment,
      awsResourcesFile,
    );
  }
}
