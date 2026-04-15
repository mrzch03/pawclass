#!/bin/bash
# sync-kb.sh — 将本地 knowledge-base 同步到 K8s PVC
#
# 用法: ./deploy/sync-kb.sh
#
# 原理: 创建临时 Pod 挂载 PVC → rsync 文件进去 → 删除临时 Pod

set -e

KB_LOCAL="projects/data-refinery/knowledge-base/"
NAMESPACE="clawbox"
PVC_NAME="pawclass-knowledge-base"
TEMP_POD="kb-sync-temp"

echo "=== Syncing knowledge-base to K8s PVC ==="

# 1. Create temp pod with PVC mounted
echo "Creating temp sync pod..."
ssh -i ~/.ssh/new.pem root@43.131.234.2 "cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: ${TEMP_POD}
  namespace: ${NAMESPACE}
spec:
  containers:
    - name: sync
      image: busybox
      command: ['sleep', '3600']
      volumeMounts:
        - name: kb
          mountPath: /data/knowledge-base
  volumes:
    - name: kb
      persistentVolumeClaim:
        claimName: ${PVC_NAME}
EOF
"

echo "Waiting for pod to be ready..."
ssh -i ~/.ssh/new.pem root@43.131.234.2 "kubectl wait --for=condition=Ready pod/${TEMP_POD} -n ${NAMESPACE} --timeout=60s"

# 2. Copy files to pod
echo "Copying knowledge-base files..."
# First tar locally, then pipe to pod
tar czf - -C "${KB_LOCAL}" . | ssh -i ~/.ssh/new.pem root@43.131.234.2 \
  "kubectl exec -i -n ${NAMESPACE} ${TEMP_POD} -- tar xzf - -C /data/knowledge-base/"

# 3. Verify
echo "Verifying..."
ssh -i ~/.ssh/new.pem root@43.131.234.2 "kubectl exec -n ${NAMESPACE} ${TEMP_POD} -- ls /data/knowledge-base/"

# 4. Cleanup temp pod
echo "Cleaning up..."
ssh -i ~/.ssh/new.pem root@43.131.234.2 "kubectl delete pod ${TEMP_POD} -n ${NAMESPACE}"

echo "=== Done! Knowledge-base synced to PVC ==="
