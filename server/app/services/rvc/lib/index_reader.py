import os
import struct
import numpy as np
import torch


class PureTorchIndex:
    def __init__(self, index_path: str, device: str = "cuda", is_half: bool = True):
        self.device = device
        self.is_half = is_half
        self.vectors = None
        self.v_norm = None

        if os.path.exists(index_path):
            self._load(index_path)

    def _load(self, index_path: str):
        with open(index_path, "rb") as f:
            data = f.read()

        idx = data.find(b"ilar")
        if idx == -1:
            return

        f = open(index_path, "rb")
        try:
            # Seek past ilar (4), nlist (8), code_size (8), mode (4), nlist2 (8)
            f.seek(idx + 4 + 8 + 8 + 4 + 8)
            sizes = [struct.unpack("<q", f.read(8))[0] for _ in range(781)]

            vectors_list = []
            for s in sizes:
                if s > 0:
                    raw_codes = f.read(s * 3072)
                    vecs = np.frombuffer(raw_codes, dtype=np.float32).reshape(s, 768)
                    vectors_list.append(vecs)
                    f.seek(s * 8, os.SEEK_CUR)  # skip ids

            if vectors_list:
                all_vectors = np.concatenate(vectors_list, axis=0)
                t_vecs = torch.from_numpy(all_vectors)
                if self.is_half:
                    t_vecs = t_vecs.half()
                else:
                    t_vecs = t_vecs.float()
                self.vectors = t_vecs.to(self.device)
                self.v_norm = (self.vectors**2).sum(dim=-1, keepdim=True).t()
        finally:
            f.close()

    def query(self, feats: torch.Tensor, index_rate: float = 0.8, k: int = 8) -> torch.Tensor:
        if self.vectors is None or index_rate <= 0:
            return feats

        # feats shape: [1, T, 768]
        batch, t_len, dim = feats.shape
        q = feats.squeeze(0)  # [T, 768]
        if self.is_half:
            q = q.half()
        else:
            q = q.float()
        q = q.to(self.device)

        q_norm = (q**2).sum(dim=-1, keepdim=True)
        # Squared Euclidean distance: ||q - v||^2 = ||q||^2 + ||v||^2 - 2 * q @ v.T
        dist = q_norm - 2 * torch.matmul(q, self.vectors.t()) + self.v_norm
        values, indices = torch.topk(dist, k=k, largest=False, dim=-1)

        # Distance-weighted interpolation
        weight = torch.square(1.0 / torch.clamp(values, min=1e-4))
        weight = weight / weight.sum(dim=-1, keepdim=True)  # [T, k]
        retrieved = (self.vectors[indices] * weight.unsqueeze(-1)).sum(dim=1)  # [T, 768]

        out = q * (1.0 - index_rate) + retrieved * index_rate
        return out.unsqueeze(0).to(feats.dtype)
