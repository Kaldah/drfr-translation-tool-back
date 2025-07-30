import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EnvironmentVariables } from 'src/env'

@Injectable()
export class RoutesService {
  constructor(private readonly configService: ConfigService<EnvironmentVariables>) {}

  public get GITHUB_ROUTES() {
    const baseUrl = this.configService.getOrThrow('GITHUB_BASE_URL', { infer: true })
    const apiBaseUrl = this.configService.getOrThrow('GITHUB_API_BASE_URL', { infer: true })

    return {
      ACCESS_TOKEN: `${baseUrl}/login/oauth/access_token`,
      AUTHENTICATED_USER: `${apiBaseUrl}/user`,
      LIST_PULL_REQUESTS: (owner: string, repo: string) => `${apiBaseUrl}/repos/${owner}/${repo}/pulls`,
      CREATE_PULL_REQUEST: (owner: string, repo: string) => `${apiBaseUrl}/repos/${owner}/${repo}/pulls`,
      CREATE_REF: (owner: string, repo: string) => `${apiBaseUrl}/repos/${owner}/${repo}/git/refs`,
      EDIT_FILE: (owner: string, repo: string, path: string) => `${apiBaseUrl}/repos/${owner}/${repo}/contents/${path}`,
      READ_FILE: (owner: string, repo: string, path: string) => `${apiBaseUrl}/repos/${owner}/${repo}/contents/${path}`,
      COMMITS: (owner: string, repo: string, branch: string) =>
        `${apiBaseUrl}/repos/${owner}/${repo}/commits/${branch}`,
      ADD_LABEL: (owner: string, repo: string, issueNumber: number) =>
        `${apiBaseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
      CREATE_LABEL: (owner: string, repo: string) => `${apiBaseUrl}/repos/${owner}/${repo}/labels`,
      DELETE_LABEL: (owner: string, repo: string, issueNumber: number, labelName: string) =>
        `${apiBaseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/labels/${labelName}`,
      GET_BRANCH: (owner: string, repo: string, branch: string) =>
        `${apiBaseUrl}/repos/${owner}/${repo}/git/ref/heads/${branch}`,
      TREE_SHA: (owner: string, repo: string, sha: string) => `${apiBaseUrl}/repos/${owner}/${repo}/git/commits/${sha}`,
      CREATE_BLOB: (owner: string, repo: string) => `${apiBaseUrl}/repos/${owner}/${repo}/git/blobs`,
      CREATE_TREE: (owner: string, repo: string) => `${apiBaseUrl}/repos/${owner}/${repo}/git/trees`,
      CREATE_COMMIT: (owner: string, repo: string) => `${apiBaseUrl}/repos/${owner}/${repo}/git/commits`,
      UPDATE_BRANCH_HEAD: (owner: string, repo: string, branch: string) =>
        `${apiBaseUrl}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      COMPARE_COMMITS: (owner: string, repo: string, base: string, branch: string) =>
        `${apiBaseUrl}/repos/${owner}/${repo}/compare/${base}...${branch}`,
      REVIEW_PULL_REQUEST: (owner: string, repo: string, pullNumber: number) =>
        `${apiBaseUrl}/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`
    } as const
  }
}
