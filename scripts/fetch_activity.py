#!/usr/bin/env python3
"""
GitHub 작업 히스토리 수집 스크립트
busungtk 관련 레포의 커밋, PR, 이슈를 수집합니다.
"""

import json
import os
from datetime import datetime, timedelta
import requests

GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
GITHUB_API = 'https://api.github.com'
USERNAME = 'junyoungjang976'

# 추적할 레포 목록 (JND 관련 제외)
TRACKED_REPOS = [
    'busungtk-docs',
    'portal',
    'hvac-mentor',
]

# 제외할 레포 패턴
EXCLUDED_PATTERNS = ['jnd', 'JND']

headers = {
    'Authorization': f'token {GITHUB_TOKEN}',
    'Accept': 'application/vnd.github.v3+json'
}


def fetch_commits(repo, days=90):
    """최근 N일간 커밋 조회"""
    since = (datetime.utcnow() - timedelta(days=days)).isoformat() + 'Z'
    url = f'{GITHUB_API}/repos/{USERNAME}/{repo}/commits'
    params = {'since': since, 'per_page': 100}

    commits = []
    try:
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            for commit in response.json():
                commits.append({
                    'sha': commit['sha'][:7],
                    'message': commit['commit']['message'].split('\n')[0][:100],
                    'author': commit['commit']['author']['name'],
                    'date': commit['commit']['author']['date'],
                    'url': commit['html_url'],
                    'repo': repo
                })
    except Exception as e:
        print(f"Error fetching commits for {repo}: {e}")

    return commits


def fetch_pull_requests(repo, days=90):
    """PR 조회"""
    url = f'{GITHUB_API}/repos/{USERNAME}/{repo}/pulls'
    params = {'state': 'all', 'per_page': 100, 'sort': 'updated', 'direction': 'desc'}

    prs = []
    try:
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            cutoff = datetime.utcnow() - timedelta(days=days)
            for pr in response.json():
                updated = datetime.fromisoformat(pr['updated_at'].replace('Z', '+00:00'))
                if updated.replace(tzinfo=None) < cutoff:
                    continue
                prs.append({
                    'number': pr['number'],
                    'title': pr['title'][:100],
                    'state': pr['state'],
                    'author': pr['user']['login'],
                    'created_at': pr['created_at'],
                    'updated_at': pr['updated_at'],
                    'merged_at': pr.get('merged_at'),
                    'url': pr['html_url'],
                    'repo': repo
                })
    except Exception as e:
        print(f"Error fetching PRs for {repo}: {e}")

    return prs


def fetch_issues(repo, days=90):
    """이슈 조회"""
    url = f'{GITHUB_API}/repos/{USERNAME}/{repo}/issues'
    params = {'state': 'all', 'per_page': 100, 'sort': 'updated', 'direction': 'desc'}

    issues = []
    try:
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            cutoff = datetime.utcnow() - timedelta(days=days)
            for issue in response.json():
                # PR은 제외 (이슈 API에 PR도 포함됨)
                if 'pull_request' in issue:
                    continue
                updated = datetime.fromisoformat(issue['updated_at'].replace('Z', '+00:00'))
                if updated.replace(tzinfo=None) < cutoff:
                    continue
                issues.append({
                    'number': issue['number'],
                    'title': issue['title'][:100],
                    'state': issue['state'],
                    'author': issue['user']['login'],
                    'created_at': issue['created_at'],
                    'updated_at': issue['updated_at'],
                    'closed_at': issue.get('closed_at'),
                    'labels': [l['name'] for l in issue.get('labels', [])],
                    'url': issue['html_url'],
                    'repo': repo
                })
    except Exception as e:
        print(f"Error fetching issues for {repo}: {e}")

    return issues


def get_repo_list():
    """사용자의 레포 목록 조회 (제외 패턴 적용)"""
    url = f'{GITHUB_API}/users/{USERNAME}/repos'
    params = {'per_page': 100, 'sort': 'updated'}

    repos = []
    try:
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            for repo in response.json():
                name = repo['name']
                # 제외 패턴 체크
                if any(pattern.lower() in name.lower() for pattern in EXCLUDED_PATTERNS):
                    continue
                # oh-my-claudecode는 fork이므로 제외 (선택사항)
                if repo.get('fork'):
                    continue
                repos.append(name)
    except Exception as e:
        print(f"Error fetching repo list: {e}")
        repos = TRACKED_REPOS

    return repos


def generate_daily_summary(commits, prs, issues):
    """일별 요약 생성"""
    daily = {}

    for commit in commits:
        date = commit['date'][:10]
        if date not in daily:
            daily[date] = {'commits': 0, 'prs_opened': 0, 'prs_merged': 0, 'issues_opened': 0, 'issues_closed': 0}
        daily[date]['commits'] += 1

    for pr in prs:
        date = pr['created_at'][:10]
        if date not in daily:
            daily[date] = {'commits': 0, 'prs_opened': 0, 'prs_merged': 0, 'issues_opened': 0, 'issues_closed': 0}
        daily[date]['prs_opened'] += 1
        if pr.get('merged_at'):
            merge_date = pr['merged_at'][:10]
            if merge_date not in daily:
                daily[merge_date] = {'commits': 0, 'prs_opened': 0, 'prs_merged': 0, 'issues_opened': 0, 'issues_closed': 0}
            daily[merge_date]['prs_merged'] += 1

    for issue in issues:
        date = issue['created_at'][:10]
        if date not in daily:
            daily[date] = {'commits': 0, 'prs_opened': 0, 'prs_merged': 0, 'issues_opened': 0, 'issues_closed': 0}
        daily[date]['issues_opened'] += 1
        if issue.get('closed_at'):
            close_date = issue['closed_at'][:10]
            if close_date not in daily:
                daily[close_date] = {'commits': 0, 'prs_opened': 0, 'prs_merged': 0, 'issues_opened': 0, 'issues_closed': 0}
            daily[close_date]['issues_closed'] += 1

    return dict(sorted(daily.items(), reverse=True))


def main():
    print("🔍 GitHub 작업 히스토리 수집 시작...")

    # 레포 목록 조회
    repos = get_repo_list()
    print(f"📁 추적 대상 레포: {repos}")

    all_commits = []
    all_prs = []
    all_issues = []

    for repo in repos:
        print(f"  → {repo} 데이터 수집 중...")
        all_commits.extend(fetch_commits(repo))
        all_prs.extend(fetch_pull_requests(repo))
        all_issues.extend(fetch_issues(repo))

    # 날짜순 정렬
    all_commits.sort(key=lambda x: x['date'], reverse=True)
    all_prs.sort(key=lambda x: x['updated_at'], reverse=True)
    all_issues.sort(key=lambda x: x['updated_at'], reverse=True)

    # 일별 요약 생성
    daily_summary = generate_daily_summary(all_commits, all_prs, all_issues)

    # 데이터 저장
    data = {
        'updated_at': datetime.utcnow().isoformat() + 'Z',
        'repos': repos,
        'summary': {
            'total_commits': len(all_commits),
            'total_prs': len(all_prs),
            'total_issues': len(all_issues),
            'active_days': len(daily_summary)
        },
        'daily': daily_summary,
        'commits': all_commits[:200],  # 최근 200개
        'pull_requests': all_prs[:100],
        'issues': all_issues[:100]
    }

    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ 완료! 커밋 {len(all_commits)}개, PR {len(all_prs)}개, 이슈 {len(all_issues)}개 수집")


if __name__ == '__main__':
    main()
