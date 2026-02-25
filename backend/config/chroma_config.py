"""
ChromaDB Vector Database 설정 및 연결
"""

import os
import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv
from typing import List, Dict, Any
from datetime import datetime

# 환경 변수 로드
load_dotenv()

class ChromaDBConfig:
    """ChromaDB 설정 및 관리 클래스"""
    
    def __init__(self):
        """ChromaDB 클라이언트 초기화"""
        
        # ChromaDB 저장 경로
        self.db_path = os.getenv('CHROMA_DB_PATH', './data/chromadb')
        
        # ChromaDB 클라이언트 생성
        self.client = chromadb.PersistentClient(
            path=self.db_path,
            settings=Settings(
                anonymized_telemetry=False
            )
        )
        
        # 컬렉션 이름
        self.collection_name = "kpi_analysis_reports"
        
        # 컬렉션 생성 또는 가져오기
        self.collection = self._get_or_create_collection()
        
        print(f"✅ ChromaDB 초기화 완료: {self.db_path}")
    
    def _get_or_create_collection(self):
        """컬렉션을 가져오거나 없으면 생성합니다."""
        try:
            collection = self.client.get_collection(name=self.collection_name)
            print(f"📂 기존 컬렉션 로드: {self.collection_name}")
        except Exception:
            collection = self.client.create_collection(
                name=self.collection_name,
                metadata={
                    "description": "KPI 분석 리포트 저장소",
                    "created_at": datetime.now().isoformat()
                }
            )
            print(f"✨ 새 컬렉션 생성: {self.collection_name}")
        
        return collection
    
    def add_report(self, report_id: str, report_text: str, metadata: Dict[str, Any]) -> bool:
        """분석 리포트를 ChromaDB에 저장합니다."""
        try:
            # AWS Bedrock으로 임베딩 생성
            from .aws_config import aws_config
            
            print(f"🔄 임베딩 생성 중: {report_id}")
            embedding = aws_config.get_embeddings(report_text)
            
            # ChromaDB에 저장
            self.collection.add(
                documents=[report_text],
                embeddings=[embedding],
                metadatas=[metadata],
                ids=[report_id]
            )
            
            print(f"✅ 리포트 저장 완료: {report_id}")
            return True
            
        except Exception as e:
            print(f"❌ 리포트 저장 실패: {str(e)}")
            return False
    def add_report(self, report_id: str, report_text: str, metadata: dict) -> bool:
        try:
            existing = self.collection.get(ids=[report_id])
            if existing['ids']:
                print(f"⚠️ 이미 존재: {report_id} (건너뜀)")
                return True
            from .aws_config import aws_config
            embedding = aws_config.get_embeddings(report_text)
            self.collection.add(
                documents=[report_text],
                embeddings=[embedding],
                metadatas=[metadata],
                ids=[report_id]
            )
            print(f"✅ 저장 완료: {report_id}")
            return True
        except Exception as e:
            print(f"❌ 저장 실패: {str(e)}")
            return False
            
           
    def search_similar_reports(self, query_text: str, n_results: int = 5, filter_metadata: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """유사한 과거 리포트를 검색합니다."""
        try:
            from .aws_config import aws_config
            
            print(f"🔍 유사 리포트 검색 중...")
            query_embedding = aws_config.get_embeddings(query_text)
            
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=filter_metadata
            )
            
            formatted_results = []
            
            if results['ids'] and len(results['ids'][0]) > 0:
                for i in range(len(results['ids'][0])):
                    formatted_results.append({
                        'id': results['ids'][0][i],
                        'document': results['documents'][0][i],
                        'metadata': results['metadatas'][0][i],
                        'distance': results['distances'][0][i] if 'distances' in results else None
                    })
                
                print(f"✅ {len(formatted_results)}개의 유사 리포트 발견")
            else:
                print(f"⚠️ 유사 리포트를 찾지 못했습니다")
            
            return formatted_results
            
        except Exception as e:
            print(f"❌ 검색 실패: {str(e)}")
            return []
    
    def get_report_by_id(self, report_id: str) -> Dict[str, Any]:
        """특정 ID의 리포트를 조회합니다."""
        try:
            result = self.collection.get(ids=[report_id])
            
            if result['ids']:
                return {
                    'id': result['ids'][0],
                    'document': result['documents'][0],
                    'metadata': result['metadatas'][0]
                }
            else:
                return None
                
        except Exception as e:
            print(f"❌ 조회 실패: {str(e)}")
            return None
    
    def count_reports(self) -> int:
        """저장된 리포트 개수를 반환합니다."""
        return self.collection.count()
    def get_report_by_date(self, date_str: str) -> Dict[str, Any]:
        """
        특정 날짜의 리포트를 메타데이터로 직접 검색합니다.
        예: date_str = "2026-01-23"
        """
        try:
            # 메타데이터 필터로 날짜 검색
            result = self.collection.get(
                where={"date": {"$eq": date_str}}
            )

            if result['ids'] and len(result['ids']) > 0:
                print(f"   ✅ 날짜 {date_str} 리포트 발견: {result['ids'][0]}")
                return {
                    'id': result['ids'][0],
                    'document': result['documents'][0],
                    'metadata': result['metadatas'][0],
                    'distance': 0.0  # 정확 매칭
                }
            else:
                print(f"   ❌ {date_str} 날짜 리포트 없음")
                return None

        except Exception as e:
            print(f"❌ 날짜 검색 실패: {str(e)}")
            return None
    def get_all_reports(self) -> list:
        """
        ChromaDB에 저장된 모든 리포트를 가져옵니다.
        "전체 알람 분석해줘" 같은 질문에 사용합니다.
        """
        try:
            total = self.collection.count()
            if total == 0:
                return []
            
            result = self.collection.get()
            formatted = []
            for i in range(len(result['ids'])):
                formatted.append({
                    'id': result['ids'][i],
                    'document': result['documents'][i],
                    'metadata': result['metadatas'][i],
                    'distance': 0.0
                })
            
            print(f"   ✅ 전체 {len(formatted)}개 리포트 로드")
            return formatted
        except Exception as e:
            print(f"❌ 전체 조회 실패: {str(e)}")
            return []
        
    def delete_report(self, report_id: str) -> bool:
        """특정 리포트를 삭제합니다."""
        try:
            self.collection.delete(ids=[report_id])
            print(f"🗑️ 리포트 삭제 완료: {report_id}")
            return True
        except Exception as e:
            print(f"❌ 삭제 실패: {str(e)}")
            return False
    
    def reset_collection(self) -> bool:
        """컬렉션의 모든 데이터를 삭제합니다."""
        try:
            self.client.delete_collection(name=self.collection_name)
            self.collection = self._get_or_create_collection()
            print(f"🔄 컬렉션 초기화 완료")
            return True
        except Exception as e:
            print(f"❌ 초기화 실패: {str(e)}")
            return False


# 싱글톤 패턴으로 전역 객체 생성
chroma_config = ChromaDBConfig()