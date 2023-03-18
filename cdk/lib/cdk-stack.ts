import { CfnOutput, CfnResource, Duration, Fn, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { CfnIntegration, CfnRoute } from 'aws-cdk-lib/aws-apigatewayv2';
import { CorsHttpMethod, HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha';
import path = require('path');
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { FederatedPrincipal, ManagedPolicy, Policy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Distribution, OriginAccessIdentity, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { CfnIdentityPool, CfnIdentityPoolRoleAttachment, UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { CfnService } from 'aws-cdk-lib/aws-apprunner';

export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // UserPool
    const appUserPool = new UserPool(this, 'AppUserPool', {
      signInCaseSensitive: false,
    });

    const appUserPoolClient = new UserPoolClient(this, 'AppUserPoolClient', {
      userPool: appUserPool,
    });

    const appIdentityPool = new CfnIdentityPool(this, 'AppIdentityPool', {
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: appUserPoolClient.userPoolClientId,
          providerName: appUserPool.userPoolProviderName,
        },
      ],
    });

    const federatedPrincipal = new FederatedPrincipal(
      'cognito-identity.amazonaws.com',
      {
        StringEquals: {
          'cognito-identity.amazonaws.com:aud': appIdentityPool.ref,
        },
        'ForAnyValue:StringLike': {
          'cognito-identity.amazonaws.com:amr': 'authenticated',
        },
      },
      'sts:AssumeRoleWithWebIdentity',
    );
    const authenticatedRole = new Role(this, 'AuthenticatedRole', {
      assumedBy: federatedPrincipal,
      // TODO: add permissions
    });

    new CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: appIdentityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
    });

    // AppResourceTable
    const appResourceTable = new Table(this, 'AppResourceTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'resourceType',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });
    appResourceTable.addGlobalSecondaryIndex({
      indexName: 'resourceTypeIndex',
      partitionKey: {
        name: 'resourceType',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    // const coreServiceImage = ContainerImage.fromAsset(path.join(__dirname, '../..'))

    // // Core service
    // const vpc = new Vpc(this, 'MyVpc', {
    //   maxAzs: 3
    // });

    // const cluster = new Cluster(this, 'MyCluster', {
    //   vpc: vpc
    // });

    // const fargate = new ApplicationLoadBalancedFargateService(this, 'MyFargateService', {
    //   assignPublicIp: false,
    //   cluster: cluster,
    //   cpu: 512,
    //   desiredCount: 1,
    //   memoryLimitMiB: 2048,
    //   publicLoadBalancer: false,
    //   taskImageOptions: {
    //     environment: {
    //       COGNITO_USER_POOL_CLIENT_ID: appUserPoolClient.userPoolClientId,
    //       COGNITO_USER_POOL_ID: appUserPool.userPoolId,
    //       DATABASE_TABLE_NAME: appResourceTable.tableName,
    //       DUMMY: 'test',
    //     },
    //     // image: ContainerImage.fromEcrRepository(Repository.fromRepositoryName(this, '701071939234', 'centurion'), 'latest'),
    //     // image: ContainerImage.fromTarball(path.join(__dirname, '../iot-application.tar')),
    //     image: coreServiceImage,
    //   },
    // });
    // fargate.targetGroup.configureHealthCheck({
    //   path: '/health',
    // });
    // const appServiceTaskPolicy = new Policy(this, 'AppServiceTaskPolicy', {
    //   statements: [
    //     // TODO: tighten the core-service-instance-role-policy permissions to require actions only
    //     new PolicyStatement({
    //       actions: ['dynamodb:*'],
    //       resources: [
    //         appResourceTable.tableArn,
    //         `${appResourceTable.tableArn}/index/*`,
    //       ],
    //     }),
    //   ],
    // });
    // fargate.taskDefinition.taskRole.attachInlinePolicy(appServiceTaskPolicy);

    // const httpVpcLink = new CfnResource(this, 'HttpVpcLink', {
    //   type: 'AWS::ApiGatewayV2::VpcLink',
    //   properties: {
    //     Name: 'V2 VPC Link',
    //     SubnetIds: vpc.privateSubnets.map(m => m.subnetId)
    //   }
    // });

    // const api = new HttpApi(this, 'HttpApiGateway', {
    //   apiName: 'ApigwFargate',
    //   corsPreflight: {
    //     allowHeaders: ['Authorization'],
    //     allowMethods: [
    //       CorsHttpMethod.ANY,
    //     ],
    //     allowOrigins: ['*'],
    //     maxAge: Duration.days(10),
    //   },
    //   description: 'Integration between apigw and Application Load-Balanced Fargate Service',
    // });

    // const integration = new CfnIntegration(this, 'HttpApiGatewayIntegration', {
    //   apiId: api.httpApiId,
    //   connectionId: httpVpcLink.ref,
    //   connectionType: 'VPC_LINK',
    //   description: 'API Integration with AWS Fargate Service',
    //   integrationMethod: 'ANY',
    //   integrationType: 'HTTP_PROXY',
    //   integrationUri: fargate.listener.listenerArn,
    //   payloadFormatVersion: '1.0',
    // });

    // new CfnRoute(this, 'Route', {
    //   apiId: api.httpApiId,
    //   routeKey: 'ANY /{proxy+}',
    //   target: `integrations/${integration.ref}`,
    // })

    // new CfnOutput(this, 'APIGatewayUrl', {
    //   description: 'API Gateway URL to access the GET endpoint',
    //   value: api.url!
    // })

    // Client Asset Bucket
    const appDistributionOAI = new OriginAccessIdentity(this, 'AppDistributionOAI');
    const clientAssetBucket = new Bucket(this, 'ClientAssetBucket');
    clientAssetBucket.grantRead(appDistributionOAI);

    // Config file
    const awsResources = {
      Auth: {
        identityPoolId: appIdentityPool.ref,
        region: Stack.of(this).region,
        userPoolId: appUserPool.userPoolId,
        userPoolWebClientId: appUserPoolClient.userPoolClientId,
      },
      Database: {
        dynamoDbId: "iot-application-6b849c58-e796-4bd3-95db-bd3d01ac1fe6-ApiResourceTable-K8YOO9HLY9UE"
      },
    };

    // Client Asset Deployment
    // Asset hash to prefix the version of asset and invalidate CloudFront cache by setting new origin path.
    const assetHash = createHash('sha256').update(readFileSync(path.join(__dirname, '../app/client/build/index.html'))).digest("hex");
    const clientAssetDeployment = new BucketDeployment(this, 'ClientAssetDeployment', {
      sources: [
        // TODO: update the path to the actual code
        Source.asset(path.join(__dirname, '../app/client/build')),
        Source.data('aws-resources.js', `window.awsResources = ${JSON.stringify(awsResources)};`),
      ],
      destinationBucket: clientAssetBucket,
      destinationKeyPrefix: assetHash,
    });

    // App Distribution
    const appDistribution = new Distribution(this, 'AppDistribution', {
      defaultBehavior: {
        origin: new S3Origin(clientAssetBucket, {
          originAccessIdentity: appDistributionOAI,
          originPath: assetHash,
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
    });
    appDistribution.node.addDependency(clientAssetDeployment);
    new CfnOutput(this, 'AppDomain', {
      description: 'Domain to access the App',
      value: appDistribution.domainName,
    })

    // AppRunner service
    const serviceSourceRolePrincipal = new ServicePrincipal('build.apprunner.amazonaws.com');
    const serviceSourceRole = new Role(this, 'ServiceSourceRole', {
      assumedBy: serviceSourceRolePrincipal,
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSAppRunnerServicePolicyForECRAccess'),
      ]
    });

    const serviceInstanceRolePrincipal = new ServicePrincipal('tasks.apprunner.amazonaws.com');
    const serviceInstanceRole = new Role(this, 'ServiceInstanceRole', {
      assumedBy: serviceInstanceRolePrincipal,
    });
    serviceInstanceRole.addToPolicy(
      new PolicyStatement({
        actions: ['dynamodb:*'],
        resources: [
          appResourceTable.tableArn,
          `${appResourceTable.tableArn}/index/*`,
        ],
      }),
    );

    const coreService = new CfnService(this, 'CoreService', {
      sourceConfiguration: {
        authenticationConfiguration: {
          accessRoleArn: serviceSourceRole.roleArn,
        },
        autoDeploymentsEnabled: false,
        imageRepository: {
          imageIdentifier: Fn.sub("${AWS::AccountId}.dkr.ecr.${AWS::Region}.${AWS::URLSuffix}/cdk-hnb659fds-container-assets-${AWS::AccountId}-${AWS::Region}:a7ce11b13891e8397412fd27ae58360859c8fc7ef02b809452b955c330c373a5"),
          imageRepositoryType: 'ECR',
    
          // the properties below are optional
          imageConfiguration: {
            port: '80',
            runtimeEnvironmentVariables: [
              {
                name: 'COGNITO_USER_POOL_CLIENT_ID',
                value: appUserPoolClient.userPoolClientId,
              },
              {
                name: 'COGNITO_USER_POOL_ID',
                value: appUserPool.userPoolId,
              },
              {
                name: 'DATABASE_TABLE_NAME',
                value: appResourceTable.tableName,
              },
            ],
          },
        },
      },
      healthCheckConfiguration: {
        path: '/health',
        protocol: 'HTTP',
      },
      instanceConfiguration: {
        instanceRoleArn: serviceInstanceRole.roleArn,
      },
    
      // // the properties below are optional
      // autoScalingConfigurationArn: 'autoScalingConfigurationArn',
      // encryptionConfiguration: {
      //   kmsKey: 'kmsKey',
      // },
      // healthCheckConfiguration: {
      //   healthyThreshold: 123,
      //   interval: 123,
      //   path: 'path',
      //   protocol: 'protocol',
      //   timeout: 123,
      //   unhealthyThreshold: 123,
      // },
      // instanceConfiguration: {
      //   cpu: 'cpu',
      //   instanceRoleArn: 'instanceRoleArn',
      //   memory: 'memory',
      // },
      // networkConfiguration: {
      //   egressConfiguration: {
      //     egressType: 'egressType',
    
      //     // the properties below are optional
      //     vpcConnectorArn: 'vpcConnectorArn',
      //   },
      //   ingressConfiguration: {
      //     isPubliclyAccessible: false,
      //   },
      // },
      // observabilityConfiguration: {
      //   observabilityEnabled: false,
    
      //   // the properties below are optional
      //   observabilityConfigurationArn: 'observabilityConfigurationArn',
      // },
      // serviceName: 'serviceName',
      // tags: [{
      //   key: 'key',
      //   value: 'value',
      // }],
    });

    const api = new HttpApi(this, 'HttpApiGateway', {
      apiName: 'ApigwFargate',
      corsPreflight: {
        allowHeaders: ['Authorization'],
        allowMethods: [
          CorsHttpMethod.ANY,
        ],
        allowOrigins: ['*'],
      },
      description: 'Integration between apigw and Application Load-Balanced Fargate Service',
    });

    const integration = new CfnIntegration(this, 'HttpApiGatewayIntegration', {
      apiId: api.httpApiId,
      description: 'API Integration with AWS App Runner Service',
      integrationMethod: 'ANY',
      integrationType: 'HTTP_PROXY',
      integrationUri: `https://${coreService.attrServiceUrl}/{proxy}`,
      payloadFormatVersion: '1.0',
    });

    new CfnRoute(this, 'Route', {
      apiId: api.httpApiId,
      routeKey: 'ANY /{proxy+}',
      target: `integrations/${integration.ref}`,
    })



    /**
     * Centurion steps:
     * ✅ upload assets to s3
     * ✅ upload resources references to aws-resources.js
     * ✅ create cfn distro
     * ✅ convert old cfn template into CDK
     * ✅ fix aws resources references
     */
  }
}
