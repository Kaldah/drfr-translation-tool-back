import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager'
import { Body, Controller, Get, Inject, Logger, Post, Query, Req } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Type } from 'class-transformer'
import { IsArray, IsString, ValidateNested } from 'class-validator'
import * as dayjs from 'dayjs'
import { Request } from 'express'
import { CACHE_KEYS } from 'src/cache/cache.constants'
import { EnvironmentVariables } from 'src/env'
import { GithubHttpService } from 'src/github/http.service'
import { RoutesService } from 'src/routes/routes.service'

const filePaths = [
  {
    original: 'chapitre-0/strings_en.txt',
    translated: 'chapitre-0/strings_fr.txt',
    name: 'Strings du chapitre 0',
    category: 'Chapitre 0',
    pathsInGameFolder: {
      windows: 'data.win'
    }
  },
  {
    original: 'chapitre-1/lang_en.json',
    translated: 'chapitre-1/lang_fr.json',
    name: 'Dialogues du chapitre 1',
    category: 'Chapitre 1',
    pathsInGameFolder: {
      windows: 'chapter1_windows/lang/lang_en.json'
    }
  },
  {
    original: 'chapitre-1/strings_en.txt',
    translated: 'chapitre-1/strings_fr.txt',
    name: 'Strings du chapitre 1',
    category: 'Chapitre 1',
    pathsInGameFolder: {
      windows: 'chapter1_windows/data.win'
    }
  },
  {
    original: 'chapitre-2/strings_en.txt',
    translated: 'chapitre-2/strings_fr.txt',
    name: 'Strings du chapitre 2',
    category: 'Chapitre 2',
    pathsInGameFolder: {
      windows: 'chapter2_windows/data.win'
    }
  },
  {
    original: 'chapitre-3/strings_en.txt',
    translated: 'chapitre-3/strings_fr.txt',
    name: 'Strings du chapitre 3',
    category: 'Chapitre 3',
    pathsInGameFolder: {
      windows: 'chapter3_windows/data.win'
    }
  },
  {
    original: 'chapitre-4/strings_en.txt',
    translated: 'chapitre-4/strings_fr.txt',
    name: 'Strings du chapitre 4',
    category: 'Chapitre 4',
    pathsInGameFolder: {
      windows: 'chapter4_windows/data.win'
    }
  }
]

class CreateTranslationDto {
  // @IsString()
  // @MinLength(5)
  // @MaxLength(80)
  name: string
}

class SaveFilesFileDto {
  @IsString()
  path: string

  @IsString()
  content: string
}

class SaveFilesBodyDto {
  @IsString()
  branch: string

  @IsString()
  message: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveFilesFileDto)
  files: SaveFilesFileDto[]
}

class SubmitToCorrectionDto {
  @IsString()
  branch: string
}

@Controller('translation')
export class TranslationController {
  constructor(
    private readonly routeService: RoutesService,
    private readonly configService: ConfigService<EnvironmentVariables>,
    private readonly githubHttpService: GithubHttpService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache
  ) {}

  @Get('/list')
  async getAllTranslations(@Req() req: Request) {
    try {
      const repositoryOwner = this.configService.getOrThrow('REPOSITORY_OWNER', { infer: true })
      const repositoryName = this.configService.getOrThrow('REPOSITORY_NAME', { infer: true })
      const mainBranch = this.configService.getOrThrow('REPOSITORY_MAIN_BRANCH', { infer: true })

      Logger.log(`Getting translations for ${repositoryOwner}/${repositoryName} on branch ${mainBranch}`)
      Logger.log(`Authorization header: ${req.headers.authorization ? 'Present' : 'Missing'}`)

      const url = this.routeService.GITHUB_ROUTES.LIST_PULL_REQUESTS(repositoryOwner, repositoryName) +
        `?base=${mainBranch}&state=all`
      
      Logger.log(`Making request to: ${url}`)

      const response = await this.githubHttpService.fetch(url, { authorization: req.headers.authorization })

      Logger.log(`GitHub API response: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorText = await response.text()
        Logger.error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`)
        throw new Error(`Failed to fetch data ${response.status} ${response.statusText} - ${errorText}`)
      }
      
      const result = await response.json()
      Logger.log(`Got ${Array.isArray(result) ? result.length : 'non-array'} results from GitHub`)
      return result as unknown
    } catch (error) {
      Logger.error('Error in getAllTranslations:', error.message)
      throw error
    }
  }

  @Post('/')
  async createTranslation(@Req() req: Request, @Body() body: CreateTranslationDto) {
    const repositoryOwner = this.configService.getOrThrow('REPOSITORY_OWNER', { infer: true })
    const repositoryName = this.configService.getOrThrow('REPOSITORY_NAME', { infer: true })
    const mainBranch = this.configService.getOrThrow('REPOSITORY_MAIN_BRANCH', { infer: true })
    const translationLabel = this.configService.getOrThrow('TRANSLATION_LABEL_NAME', { infer: true })
    const wipLabel = this.configService.getOrThrow('TRANSLATION_WIP_LABEL_NAME', { infer: true })

    const lastMasterCommitResponse = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.COMMITS(repositoryOwner, repositoryName, mainBranch),
      { authorization: req.headers.authorization }
    )

    if (!lastMasterCommitResponse.ok)
      throw new Error(
        `Failed to retrieve last commit ${lastMasterCommitResponse.status} ${lastMasterCommitResponse.statusText}`
      )

    const lastMasterCommit = (await lastMasterCommitResponse.json()) as { sha: string }

    const now = dayjs()

    const head = now.format('YYYY-MM-DD-HH-mm-ss-SSS')
    const ref = `refs/heads/${head}`

    const refCreationResponse = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.CREATE_REF(repositoryOwner, repositoryName),
      {
        method: 'POST',
        authorization: req.headers.authorization,
        body: { ref, sha: lastMasterCommit.sha }
      }
    )

    if (!refCreationResponse.ok)
      throw new Error(
        `Failed to create branch ${refCreationResponse.status} ${refCreationResponse.statusText} ${await refCreationResponse.text()}`
      )

    const branchIdentifierContentsResponse = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.READ_FILE(repositoryOwner, repositoryName, '.branch-identifier') + `?ref=${head}`,
      { authorization: req.headers.authorization }
    )

    if (!branchIdentifierContentsResponse.ok)
      throw new Error(
        `Failed to read branch identifier ${branchIdentifierContentsResponse.status} ${branchIdentifierContentsResponse.statusText} ${await branchIdentifierContentsResponse.text()}`
      )

    const branchIdentifierContents = (await branchIdentifierContentsResponse.json()) as { sha: string }

    // Edit readme.md to add the branch name at the end
    const editionResponse = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.EDIT_FILE(repositoryOwner, repositoryName, '.branch-identifier'),
      {
        method: 'PUT',
        authorization: req.headers.authorization,
        body: {
          message: `Branch identifier for ${head}`,
          content: Buffer.from(head).toString('base64'),
          branch: head,
          sha: branchIdentifierContents.sha
        }
      }
    )

    if (!editionResponse.ok)
      throw new Error(
        `Failed to edit branch identifier ${editionResponse.status} ${editionResponse.statusText} ${await editionResponse.text()}`
      )

    const pullRequestCreationResponse = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.CREATE_PULL_REQUEST(repositoryOwner, repositoryName),
      {
        method: 'POST',
        authorization: req.headers.authorization,
        body: { title: body.name, head, base: mainBranch }
      }
    )

    if (!pullRequestCreationResponse.ok)
      throw new Error(
        `Failed to create PR ${pullRequestCreationResponse.status} ${pullRequestCreationResponse.statusText} ${await pullRequestCreationResponse.text()}`
      )

    const pullRequest = (await pullRequestCreationResponse.json()) as { number: number }

    const addLabelResponse = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.ADD_LABEL(repositoryOwner, repositoryName, pullRequest.number),
      {
        method: 'POST',
        authorization: req.headers.authorization,
        body: [translationLabel, wipLabel]
      }
    )

    if (!addLabelResponse.ok)
      throw new Error(
        `Failed to add label to PR ${addLabelResponse.status} ${addLabelResponse.statusText} ${await addLabelResponse.text()}`
      )

    return pullRequest
  }

  @Get('/files')
  public async getFiles(@Req() req: Request, @Query('branch') branch: string) {
    const cachedFiles = await this.cacheManager.get(CACHE_KEYS.FILES(branch))
    if (cachedFiles) {
      Logger.log(`Returning cached files for branch ${branch}`)
      return cachedFiles
    }

    const repositoryOwner = this.configService.getOrThrow('REPOSITORY_OWNER', { infer: true })
    const repositoryName = this.configService.getOrThrow('REPOSITORY_NAME', { infer: true })

    const files = await Promise.all(
      filePaths.map(async ({ original, translated, name, category, pathsInGameFolder }) => {
        const originalFileResponse = await this.githubHttpService.fetch(
          this.routeService.GITHUB_ROUTES.READ_FILE(repositoryOwner, repositoryName, original) + `?ref=${branch}`,
          { authorization: req.headers.authorization }
        )

        if (!originalFileResponse.ok)
          throw new Error(
            `Failed to read original file ${originalFileResponse.status} ${originalFileResponse.statusText} ${await originalFileResponse.text()}`
          )

        const originalFile = (await originalFileResponse.json()) as { download_url: string }

        const translatedFileResponse = await this.githubHttpService.fetch(
          this.routeService.GITHUB_ROUTES.READ_FILE(repositoryOwner, repositoryName, translated) + `?ref=${branch}`,
          { authorization: req.headers.authorization }
        )

        if (!translatedFileResponse.ok)
          throw new Error(
            `Failed to read translated file ${translatedFileResponse.status} ${translatedFileResponse.statusText} ${await translatedFileResponse.text()}`
          )

        const translatedFile = (await translatedFileResponse.json()) as { download_url: string }

        return {
          category,
          name,
          pathsInGameFolder,
          translatedPath: translated,
          originalPath: original,
          original: originalFile.download_url,
          translated: translatedFile.download_url
        }
      })
    )

    await this.cacheManager.set(CACHE_KEYS.FILES(branch), files, 60 * 60)

    return files
  }

  @Get('/files-at-branch-creation')
  public async getFilesAtBranchCreation(@Req() req: Request, @Query('branch') branch: string) {
    const repositoryOwner = this.configService.getOrThrow('REPOSITORY_OWNER', { infer: true })
    const repositoryName = this.configService.getOrThrow('REPOSITORY_NAME', { infer: true })
    const mainBranch = this.configService.getOrThrow('REPOSITORY_MAIN_BRANCH', { infer: true })

    const commitComparisonResponse = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.COMPARE_COMMITS(repositoryOwner, repositoryName, mainBranch, branch),
      { authorization: req.headers.authorization }
    )
    if (!commitComparisonResponse.ok)
      throw new Error(
        `Failed to compare commits ${commitComparisonResponse.status} ${commitComparisonResponse.statusText} ${await commitComparisonResponse.text()}`
      )

    const commitComparisonData = (await commitComparisonResponse.json()) as { merge_base_commit: { sha: string } }

    const files = await Promise.all(
      filePaths.map(async ({ original, translated, name, category, pathsInGameFolder }) => {
        const originalFileResponse = await this.githubHttpService.fetch(
          this.routeService.GITHUB_ROUTES.READ_FILE(repositoryOwner, repositoryName, original) +
            `?ref=${commitComparisonData.merge_base_commit.sha}`,
          { authorization: req.headers.authorization }
        )

        if (!originalFileResponse.ok)
          throw new Error(
            `Failed to read original file ${originalFileResponse.status} ${originalFileResponse.statusText} ${await originalFileResponse.text()}`
          )

        const originalFile = (await originalFileResponse.json()) as { download_url: string }

        const translatedFileResponse = await this.githubHttpService.fetch(
          this.routeService.GITHUB_ROUTES.READ_FILE(repositoryOwner, repositoryName, translated) +
            `?ref=${commitComparisonData.merge_base_commit.sha}`,
          { authorization: req.headers.authorization }
        )

        if (!translatedFileResponse.ok)
          throw new Error(
            `Failed to read translated file ${translatedFileResponse.status} ${translatedFileResponse.statusText} ${await translatedFileResponse.text()}`
          )

        const translatedFile = (await translatedFileResponse.json()) as { download_url: string }

        return {
          category,
          name,
          pathsInGameFolder,
          translatedPath: translated,
          originalPath: original,
          original: originalFile.download_url,
          translated: translatedFile.download_url
        }
      })
    )

    return files
  }

  @Post('/files')
  public async saveFiles(@Req() req: Request, @Body() body: SaveFilesBodyDto) {
    const repositoryOwner = this.configService.getOrThrow('REPOSITORY_OWNER', { infer: true })
    const repositoryName = this.configService.getOrThrow('REPOSITORY_NAME', { infer: true })

    console.log(`Getting files at branch creation for branch ${body.branch}`)

    const refResponse = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.GET_BRANCH(repositoryOwner, repositoryName, body.branch),
      { authorization: req.headers.authorization }
    )

    if (!refResponse.ok)
      throw new Error(`Failed to get ref ${refResponse.status} ${refResponse.statusText} ${await refResponse.text()}`)

    const refData = (await refResponse.json()) as { object: { sha: string } }
    const commitSha = refData.object.sha

    const treeShaResponse = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.TREE_SHA(repositoryOwner, repositoryName, commitSha),
      { authorization: req.headers.authorization }
    )

    if (!treeShaResponse.ok)
      throw new Error(
        `Failed to get tree sha ${treeShaResponse.status} ${treeShaResponse.statusText} ${await treeShaResponse.text()}`
      )

    const commitData = (await treeShaResponse.json()) as { tree: { sha: string } }
    const baseTreeSha = commitData.tree.sha

    const blobsPromises = body.files.map(async (file) => {
      const blobResponse = await this.githubHttpService.fetch(
        this.routeService.GITHUB_ROUTES.CREATE_BLOB(repositoryOwner, repositoryName),
        {
          method: 'POST',
          authorization: req.headers.authorization,
          body: { content: file.content, encoding: 'utf-8' }
        }
      )

      if (!blobResponse.ok)
        throw new Error(
          `Failed to create blob ${blobResponse.status} ${blobResponse.statusText} ${await blobResponse.text()}`
        )

      const blobData = (await blobResponse.json()) as { sha: string }
      return {
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha
      }
    })

    const blobs = await Promise.all(blobsPromises)

    const newTreeResponse = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.CREATE_TREE(repositoryOwner, repositoryName),
      {
        method: 'POST',
        authorization: req.headers.authorization,
        body: { base_tree: baseTreeSha, tree: blobs }
      }
    )
    if (!newTreeResponse.ok)
      throw new Error(
        `Failed to create tree ${newTreeResponse.status} ${newTreeResponse.statusText} ${await newTreeResponse.text()}`
      )
    const newTreeData = (await newTreeResponse.json()) as { sha: string }

    const newCommitResponse = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.CREATE_COMMIT(repositoryOwner, repositoryName),
      {
        method: 'POST',
        authorization: req.headers.authorization,
        body: { message: body.message, tree: newTreeData.sha, parents: [commitSha] }
      }
    )
    if (!newCommitResponse.ok)
      throw new Error(
        `Failed to create commit ${newCommitResponse.status} ${newCommitResponse.statusText} ${await newCommitResponse.text()}`
      )
    const newCommitData = (await newCommitResponse.json()) as { sha: string }

    const updateBranchHeadResponse = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.UPDATE_BRANCH_HEAD(repositoryOwner, repositoryName, body.branch),
      {
        method: 'PATCH',
        authorization: req.headers.authorization,
        body: { sha: newCommitData.sha }
      }
    )

    if (!updateBranchHeadResponse.ok)
      throw new Error(
        `Failed to update branch head ${updateBranchHeadResponse.status} ${updateBranchHeadResponse.statusText} ${await updateBranchHeadResponse.text()}`
      )

    await this.cacheManager.del(CACHE_KEYS.FILES(body.branch))

    return { success: true }
  }

  @Post('/submit-to-review')
  async review(@Req() req: Request, @Body() body: SubmitToCorrectionDto) {
    const repositoryOwner = this.configService.getOrThrow('REPOSITORY_OWNER', { infer: true })
    const repositoryName = this.configService.getOrThrow('REPOSITORY_NAME', { infer: true })
    const mainBranch = this.configService.getOrThrow('REPOSITORY_MAIN_BRANCH', { infer: true })
    const translationLabel = this.configService.getOrThrow('TRANSLATION_LABEL_NAME', { infer: true })
    const reviewLabel = this.configService.getOrThrow('TRANSLATION_REVIEW_LABEL_NAME', { infer: true })
    const wipLabel = this.configService.getOrThrow('TRANSLATION_WIP_LABEL_NAME', { infer: true })

    const response = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.LIST_PULL_REQUESTS(repositoryOwner, repositoryName) +
        `?head=${body.branch}&base=${mainBranch}`,
      { authorization: req.headers.authorization }
    )

    if (!response.ok) throw new Error(`Failed to fetch data ${response.status} ${response.statusText}`)
    const pullRequests = (await response.json()) as { number: number }[]

    const deleteLabelResponse = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.DELETE_LABEL(repositoryOwner, repositoryName, pullRequests[0].number, wipLabel),
      { method: 'DELETE', authorization: req.headers.authorization }
    )

    if (!deleteLabelResponse.ok)
      throw new Error(
        `Failed to delete label from PR ${deleteLabelResponse.status} ${deleteLabelResponse.statusText} ${await deleteLabelResponse.text()}`
      )

    const addLabelResponse = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.ADD_LABEL(repositoryOwner, repositoryName, pullRequests[0].number),
      {
        method: 'POST',
        authorization: req.headers.authorization,
        body: [translationLabel, reviewLabel]
      }
    )

    if (!addLabelResponse.ok)
      throw new Error(
        `Failed to add label to PR ${addLabelResponse.status} ${addLabelResponse.statusText} ${await addLabelResponse.text()}`
      )

    return { success: true }
  }

  @Post('/approve')
  async approveTranslation(@Req() req: Request, @Body() body: { branch: string }) {
    const repositoryOwner = this.configService.getOrThrow('REPOSITORY_OWNER', { infer: true })
    const repositoryName = this.configService.getOrThrow('REPOSITORY_NAME', { infer: true })
    const mainBranch = this.configService.getOrThrow('REPOSITORY_MAIN_BRANCH', { infer: true })

    const response = await this.githubHttpService.fetch(
      this.routeService.GITHUB_ROUTES.LIST_PULL_REQUESTS(repositoryOwner, repositoryName) +
        `?head=${body.branch}&base=${mainBranch}`,
      { authorization: req.headers.authorization }
    )

    if (!response.ok) throw new Error(`Failed to fetch data ${response.status} ${response.statusText}`)
    const pullRequests = (await response.json()) as { number: number }[]

    if (pullRequests.length === 0) {
      throw new Error(`No pull request found for branch ${body.branch}`)
    }

    const pullRequestNumber = pullRequests[0].number

    const reviewResponse = await this.githubHttpService.fetch(
      `${this.routeService.GITHUB_ROUTES.REVIEW_PULL_REQUEST(repositoryOwner, repositoryName, pullRequestNumber)}`,
      {
        method: 'POST',
        authorization: req.headers.authorization,
        body: {
          event: 'APPROVE',
          body: 'LGTM 👍'
        }
      }
    )

    if (!reviewResponse.ok)
      throw new Error(`Failed to approve translation ${reviewResponse.status} ${reviewResponse.statusText}`)

    return { success: true }
  }

  @Post('/setup-labels')
  async setupLabels(@Req() req: Request) {
    const repositoryOwner = this.configService.getOrThrow('REPOSITORY_OWNER', { infer: true })
    const repositoryName = this.configService.getOrThrow('REPOSITORY_NAME', { infer: true })
    const translationLabel = this.configService.getOrThrow('TRANSLATION_LABEL_NAME', { infer: true })
    const wipLabel = this.configService.getOrThrow('TRANSLATION_WIP_LABEL_NAME', { infer: true })
    const reviewLabel = this.configService.getOrThrow('TRANSLATION_REVIEW_LABEL_NAME', { infer: true })

    const labels = [
      { name: translationLabel, color: '0075ca', description: 'Pull request de traduction' },
      { name: wipLabel, color: 'd73a4a', description: 'Traduction en cours de développement' },
      { name: reviewLabel, color: 'a2eeef', description: 'Traduction prête pour révision' }
    ]

    const createdLabels: string[] = []

    for (const label of labels) {
      try {
        const response = await this.githubHttpService.fetch(
          this.routeService.GITHUB_ROUTES.CREATE_LABEL(repositoryOwner, repositoryName),
          {
            method: 'POST',
            authorization: req.headers.authorization,
            body: label
          }
        )

        if (response.ok) {
          createdLabels.push(label.name)
          Logger.log(`Created label: ${label.name}`)
        } else if (response.status === 422) {
          Logger.log(`Label already exists: ${label.name}`)
        } else {
          Logger.error(`Failed to create label ${label.name}: ${response.status} ${response.statusText}`)
        }
      } catch (error) {
        Logger.error(`Error creating label ${label.name}:`, error.message)
      }
    }

    return { createdLabels, message: 'Labels setup completed' }
  }
}
